import { constants } from "node:fs";
import { lstat, open, readlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { writeJsonAtomic } from "../core/json.ts";
import type { DokionPlaybook, WorktreePolicy } from "../playbook/types.ts";

export const WORKTREE_BASELINE_PATH = ".dokion/worktree-baseline.json";
export const MAX_WORKTREE_ENTRIES = 10_000;
export const MAX_WORKTREE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_GIT_CAPTURE_BYTES = 64 * 1024 * 1024;
export const MAX_WORKTREE_SNAPSHOT_BYTES = 128 * 1024 * 1024;

type WorktreeEntryKind = "file" | "symlink" | "missing";

export interface WorktreeBaselineEntry {
  path: string;
  status: string;
  kind: WorktreeEntryKind;
  digest: string;
  size: number;
  mode?: number;
  target?: string;
  content?: string;
}

export interface WorktreeBaseline {
  schema_version: 1;
  policy: WorktreePolicy;
  captured_at: string;
  dirty: boolean;
  entries: WorktreeBaselineEntry[];
  index_patch_digest: string;
  worktree_patch_digest: string;
  index_patch?: string;
  worktree_patch?: string;
  snapshot_digest: string;
}

export interface WorktreeStatusEntry {
  status: string;
  path: string;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function assertRepositoryPath(path: string): void {
  if (!path || isAbsolute(path) || path.split("/").includes("..")) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Git returned an unsafe repository path", {
      path
    });
  }
}

function isDokionOwned(path: string): boolean {
  return path === ".dokion"
    || path.startsWith(".dokion/")
    || path === "HARDENING.md"
    || path === ".git"
    || path.startsWith(".git/");
}

export function parseWorktreeStatus(
  output: Uint8Array,
  maxEntries = MAX_WORKTREE_ENTRIES
): WorktreeStatusEntry[] {
  let fields: string[];
  try {
    fields = new TextDecoder("utf-8", { fatal: true }).decode(output).split("\0");
  } catch (error) {
    throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", "Git returned a path that is not valid UTF-8", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  const entries: WorktreeStatusEntry[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const path = field.slice(3);
    assertRepositoryPath(path);

    if (!isDokionOwned(path)) entries.push({ status, path });
    if (!status.includes("R") && !status.includes("C")) continue;

    const originalPath = fields[index + 1];
    if (!originalPath) {
      throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", "Git returned an incomplete rename record", {
        path
      });
    }
    index += 1;
    assertRepositoryPath(originalPath);
    if (status.includes("R") && !isDokionOwned(originalPath)) {
      entries.push({ status: " D", path: originalPath });
    }
  }

  const uniqueEntries = Array.from(new Map(entries.map((entry) => [entry.path, entry])).values())
    .sort((left, right) => left.path.localeCompare(right.path));
  if (uniqueEntries.length > maxEntries) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree exceeds the entry capture limit", {
      entries: uniqueEntries.length,
      max_entries: maxEntries
    });
  }
  return uniqueEntries;
}

async function runGitBytes(root: string, args: string[], operation: string): Promise<Uint8Array> {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
    maxBuffer: MAX_GIT_CAPTURE_BYTES
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    child.stdout ? new Response(child.stdout).arrayBuffer() : new ArrayBuffer(0),
    child.stderr ? new Response(child.stderr).text() : "",
    child.exited
  ]);
  if (stdout.byteLength > MAX_GIT_CAPTURE_BYTES) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Git output exceeds the capture limit", {
      operation,
      bytes: stdout.byteLength,
      max_bytes: MAX_GIT_CAPTURE_BYTES
    });
  }
  if (exitCode !== 0) {
    throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", `Unable to ${operation}`, {
      exit_code: exitCode,
      error: stderr.trim() || `git ${args[0] ?? "command"} failed`
    });
  }
  return new Uint8Array(stdout);
}

async function readStatus(root: string): Promise<WorktreeStatusEntry[]> {
  const output = await runGitBytes(
    root,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    "inspect the Git worktree"
  );
  return parseWorktreeStatus(output);
}

interface WorktreePatches {
  index: Uint8Array;
  worktree: Uint8Array;
}

async function capturePatches(root: string): Promise<WorktreePatches> {
  const pathspec = ["--", ".", ":(exclude).dokion/**", ":(exclude)HARDENING.md"];
  const [index, worktree] = await Promise.all([
    runGitBytes(
      root,
      ["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", "--no-renames", ...pathspec],
      "capture the staged worktree patch"
    ),
    runGitBytes(
      root,
      ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", ...pathspec],
      "capture the unstaged worktree patch"
    )
  ]);
  return { index, worktree };
}

interface FileIdentity {
  dev: number;
  ino: number;
}

export async function readRegularFileSnapshot(
  path: string,
  expectedIdentity?: FileIdentity,
  maxBytes = MAX_WORKTREE_FILE_BYTES
): Promise<{ bytes: Buffer; mode: number }> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile()) {
      throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Snapshot path is not a regular file", { path });
    }
    if (expectedIdentity && (before.dev !== expectedIdentity.dev || before.ino !== expectedIdentity.ino)) {
      throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree entry changed before capture", { path });
    }
    if (before.size > maxBytes) {
      throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree file exceeds the capture limit", {
        path,
        bytes: before.size,
        max_bytes: maxBytes
      });
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
      || before.ctimeMs !== after.ctimeMs
    ) {
      throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree entry changed during capture", { path });
    }
    return { bytes, mode: before.mode & 0o777 };
  } catch (error) {
    if (error instanceof DokionError) throw error;
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Unable to read dirty worktree file safely", {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await handle?.close();
  }
}

async function captureEntry(
  root: string,
  entry: WorktreeStatusEntry,
  includeContent: boolean
): Promise<WorktreeBaselineEntry> {
  const absolute = join(root, entry.path);
  try {
    const stat = await lstat(absolute);
    const mode = stat.mode & 0o777;
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute);
      const after = await lstat(absolute);
      if (
        !after.isSymbolicLink()
        || stat.dev !== after.dev
        || stat.ino !== after.ino
        || stat.mtimeMs !== after.mtimeMs
        || stat.ctimeMs !== after.ctimeMs
      ) {
        throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty symlink changed during capture", {
          path: entry.path
        });
      }
      return {
        path: entry.path,
        status: entry.status,
        kind: "symlink",
        size: Buffer.byteLength(target),
        mode,
        ...(includeContent ? { target } : {}),
        digest: sha256(`symlink:${target}:${mode}`)
      };
    }
    if (!stat.isFile()) {
      throw new DokionError(
        "WORKTREE_SNAPSHOT_FAILED",
        "Dirty worktree contains an unsupported entry",
        { path: entry.path }
      );
    }
    const snapshot = await readRegularFileSnapshot(absolute, { dev: stat.dev, ino: stat.ino });
    return {
      path: entry.path,
      status: entry.status,
      kind: "file",
      size: snapshot.bytes.byteLength,
      mode: snapshot.mode,
      digest: sha256(snapshot.bytes),
      ...(includeContent ? { content: snapshot.bytes.toString("base64") } : {})
    };
  } catch (error) {
    if (isMissing(error)) {
      return {
        path: entry.path,
        status: entry.status,
        kind: "missing",
        size: 0,
        digest: sha256("missing")
      };
    }
    if (error instanceof DokionError) throw error;
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Unable to capture dirty worktree entry", {
      path: entry.path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function resolvePolicy(playbook: DokionPlaybook): WorktreePolicy {
  return playbook.enforcement?.worktree_policy ?? "clean-only";
}

export async function enforceWorktreePolicy(
  root: string,
  playbook: DokionPlaybook
): Promise<WorktreeBaseline> {
  const policy = resolvePolicy(playbook);
  const statusEntries = await readStatus(root);
  if (policy === "clean-only" && statusEntries.length > 0) {
    throw new DokionError(
      "DIRTY_WORKTREE_BLOCKED",
      "Write-capable execution requires a clean worktree",
      { policy, paths: statusEntries.map((entry) => entry.path) }
    );
  }

  const includeContent = policy === "snapshot-existing-dirty";
  const initialPatches = await capturePatches(root);
  const entries: WorktreeBaselineEntry[] = [];
  for (const entry of statusEntries) {
    entries.push(await captureEntry(root, entry, includeContent));
  }
  const [finalStatus, finalPatches] = await Promise.all([
    readStatus(root),
    capturePatches(root)
  ]);
  const indexPatchDigest = sha256(initialPatches.index);
  const worktreePatchDigest = sha256(initialPatches.worktree);
  if (
    JSON.stringify(statusEntries) !== JSON.stringify(finalStatus)
    || indexPatchDigest !== sha256(finalPatches.index)
    || worktreePatchDigest !== sha256(finalPatches.worktree)
  ) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree changed during baseline capture");
  }

  const dirty = entries.length > 0;
  const snapshotBytes = initialPatches.index.byteLength
    + initialPatches.worktree.byteLength
    + entries.reduce((total, entry) => total + entry.size, 0);
  if (includeContent && snapshotBytes > MAX_WORKTREE_SNAPSHOT_BYTES) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree snapshot exceeds the total capture limit", {
      bytes: snapshotBytes,
      max_bytes: MAX_WORKTREE_SNAPSHOT_BYTES
    });
  }
  const patchFields = {
    index_patch_digest: indexPatchDigest,
    worktree_patch_digest: worktreePatchDigest,
    ...(includeContent ? {
      index_patch: Buffer.from(initialPatches.index).toString("base64"),
      worktree_patch: Buffer.from(initialPatches.worktree).toString("base64")
    } : {})
  };
  const snapshotDigest = sha256(JSON.stringify({ policy, dirty, entries, ...patchFields }));
  const baseline: WorktreeBaseline = {
    schema_version: 1,
    policy,
    captured_at: new Date().toISOString(),
    dirty,
    entries,
    ...patchFields,
    snapshot_digest: snapshotDigest
  };

  await writeJsonAtomic(join(root, WORKTREE_BASELINE_PATH), baseline);
  return baseline;
}
