import { constants } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { writeJsonAtomic } from "../core/json.ts";
import type { DokionPlaybook, WorktreePolicy } from "../playbook/types.ts";

export const WORKTREE_BASELINE_PATH = ".dokion/worktree-baseline.json";
export const MAX_WORKTREE_ENTRIES = 10_000;
export const MAX_WORKTREE_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_GIT_CAPTURE_BYTES = 64 * 1024 * 1024;
export const MAX_WORKTREE_SNAPSHOT_BYTES = 128 * 1024 * 1024;
export const MAX_WORKTREE_BASELINE_BYTES = 192 * 1024 * 1024;

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
  project_path: string;
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

interface GitScope {
  gitRoot: string;
  projectRoot: string;
  projectPath: string;
}

interface WorktreePatches {
  index: Uint8Array;
  worktree: Uint8Array;
}

interface FileIdentity {
  dev: number;
  ino: number;
}

interface WorktreePolicyCaptureHooks {
  expectedSnapshotDigest?: string;
  expectedPolicy?: WorktreePolicy;
  expectedProjectPath?: string;
  afterInitialStatusAndPatches?: () => Promise<void>;
  afterInitialCapture?: () => Promise<void>;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function nativeRelativeToGitPath(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

function assertRepositoryPath(path: string): void {
  const traversalPath = process.platform === "win32" ? path.replaceAll("\\", "/") : path;
  if (!path || isAbsolute(path) || traversalPath.split("/").includes("..")) {
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

function decodeGitText(output: Uint8Array, operation: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(output);
  } catch (error) {
    throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", `Git returned invalid UTF-8 while attempting to ${operation}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
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
    entries.push({ status, path });
    if (!status.includes("R") && !status.includes("C")) continue;

    const originalPath = fields[index + 1];
    if (!originalPath) {
      throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", "Git returned an incomplete rename record", {
        path
      });
    }
    index += 1;
    const normalizedOriginal = originalPath;
    assertRepositoryPath(normalizedOriginal);
    if (status.includes("R")) entries.push({ status: " D", path: normalizedOriginal });
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
  let child;
  try {
    child = Bun.spawn(["git", ...args], {
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
  } catch (error) {
    if (error instanceof DokionError) throw error;
    throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", `Unable to ${operation}`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function resolveGitScope(root: string): Promise<GitScope> {
  const projectRoot = await realpath(root);
  const topLevelOutput = await runGitBytes(projectRoot, ["rev-parse", "--show-toplevel"], "resolve the Git top level");
  const topLevel = decodeGitText(topLevelOutput, "resolve the Git top level").trim();
  const gitRoot = await realpath(topLevel);
  const relativeProject = nativeRelativeToGitPath(relative(gitRoot, projectRoot));
  if (isAbsolute(relativeProject) || relativeProject === ".." || relativeProject.startsWith("../")) {
    throw new DokionError("WORKTREE_POLICY_UNAVAILABLE", "Project root is outside the resolved Git worktree", {
      project_root: projectRoot
    });
  }
  return {
    gitRoot,
    projectRoot,
    projectPath: relativeProject || "."
  };
}

function scopeStatusEntries(
  entries: WorktreeStatusEntry[],
  scope: GitScope
): WorktreeStatusEntry[] {
  const scoped: WorktreeStatusEntry[] = [];
  for (const entry of entries) {
    let path: string | undefined;
    if (scope.projectPath === ".") path = entry.path;
    else if (entry.path.startsWith(`${scope.projectPath}/`)) path = entry.path.slice(scope.projectPath.length + 1);
    if (!path) continue;
    assertRepositoryPath(path);
    if (!isDokionOwned(path)) scoped.push({ ...entry, path });
  }
  const unique = Array.from(new Map(scoped.map((entry) => [entry.path, entry])).values())
    .sort((left, right) => left.path.localeCompare(right.path));
  if (unique.length > MAX_WORKTREE_ENTRIES) {
    throw new DokionError("WORKTREE_SNAPSHOT_FAILED", "Dirty worktree exceeds the entry capture limit", {
      entries: unique.length,
      max_entries: MAX_WORKTREE_ENTRIES
    });
  }
  return unique;
}

async function readStatus(scope: GitScope): Promise<WorktreeStatusEntry[]> {
  const output = await runGitBytes(
    scope.gitRoot,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", ...scopedPathspec(scope)],
    "inspect the Git worktree"
  );
  return scopeStatusEntries(parseWorktreeStatus(output), scope);
}

function scopedPathspec(scope: GitScope): string[] {
  const prefix = scope.projectPath === "." ? "" : `${scope.projectPath}/`;
  const project = scope.projectPath === "."
    ? ":(top,glob)**"
    : `:(top,literal)${scope.projectPath}`;
  return [
    "--",
    project,
    `:(top,exclude,glob)${prefix}.dokion/**`,
    `:(top,exclude,literal)${prefix}HARDENING.md`
  ];
}

async function capturePatches(scope: GitScope): Promise<WorktreePatches> {
  const pathspec = scopedPathspec(scope);
  const [index, worktree] = await Promise.all([
    runGitBytes(
      scope.gitRoot,
      ["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", "--no-renames", ...pathspec],
      "capture the staged worktree patch"
    ),
    runGitBytes(
      scope.gitRoot,
      ["diff", "--binary", "--full-index", "--no-ext-diff", "--no-textconv", "--no-renames", ...pathspec],
      "capture the unstaged worktree patch"
    )
  ]);
  return { index, worktree };
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

async function captureEntries(
  root: string,
  statusEntries: WorktreeStatusEntry[],
  includeContent: boolean
): Promise<WorktreeBaselineEntry[]> {
  const entries: WorktreeBaselineEntry[] = [];
  for (const entry of statusEntries) entries.push(await captureEntry(root, entry, includeContent));
  return entries;
}

function comparableEntries(entries: WorktreeBaselineEntry[]): Array<Omit<WorktreeBaselineEntry, "content" | "target">> {
  return entries.map(({ content: _content, target: _target, ...entry }) => entry);
}

function entriesDigest(entries: WorktreeBaselineEntry[]): string {
  return sha256(JSON.stringify(comparableEntries(entries)));
}

function resolvePolicy(playbook: DokionPlaybook): WorktreePolicy {
  return playbook.enforcement?.worktree_policy ?? "clean-only";
}

function patchFields(patches: WorktreePatches, includeContent: boolean): Pick<
  WorktreeBaseline,
  "index_patch_digest" | "worktree_patch_digest" | "index_patch" | "worktree_patch"
> {
  return {
    index_patch_digest: sha256(patches.index),
    worktree_patch_digest: sha256(patches.worktree),
    ...(includeContent ? {
      index_patch: Buffer.from(patches.index).toString("base64"),
      worktree_patch: Buffer.from(patches.worktree).toString("base64")
    } : {})
  };
}

function baselineDigest(input: Omit<WorktreeBaseline, "schema_version" | "captured_at" | "snapshot_digest">): string {
  return sha256(JSON.stringify(input));
}

async function readStoredBaseline(path: string): Promise<WorktreeBaseline> {
  const snapshot = await readRegularFileSnapshot(
    path,
    undefined,
    MAX_WORKTREE_BASELINE_BYTES
  );
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes);
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("baseline root must be an object");
    }
    return value as WorktreeBaseline;
  } catch (error) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Stored worktree baseline is not valid UTF-8 JSON",
      { cause: error instanceof Error ? error.message : String(error) }
    );
  }
}

function assertBaselineIntegrity(baseline: WorktreeBaseline): void {
  const {
    schema_version: schemaVersion,
    captured_at: _capturedAt,
    snapshot_digest: observedDigest,
    ...content
  } = baseline;
  if (schemaVersion !== 1 || observedDigest !== baselineDigest(content)) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Stored worktree baseline failed integrity validation"
    );
  }
}

export async function enforceWorktreePolicy(
  root: string,
  playbook: DokionPlaybook,
  hooks: WorktreePolicyCaptureHooks = {}
): Promise<WorktreeBaseline> {
  const policy = resolvePolicy(playbook);
  const scope = await resolveGitScope(root);
  const [statusEntries, initialPatches] = await Promise.all([
    readStatus(scope),
    capturePatches(scope)
  ]);
  if (policy === "clean-only" && statusEntries.length > 0) {
    throw new DokionError(
      "DIRTY_WORKTREE_BLOCKED",
      "Write-capable execution requires a clean worktree",
      { policy, paths: statusEntries.map((entry) => entry.path) }
    );
  }

  const includeContent = policy === "snapshot-existing-dirty";
  await hooks.afterInitialStatusAndPatches?.();
  const entries = await captureEntries(scope.projectRoot, statusEntries, includeContent);
  await hooks.afterInitialCapture?.();
  const finalStatus = await readStatus(scope);
  const finalPatches = await capturePatches(scope);
  const finalEntries = await captureEntries(scope.projectRoot, finalStatus, false);
  const initialPatchFields = patchFields(initialPatches, includeContent);
  const finalPatchFields = patchFields(finalPatches, false);
  if (
    JSON.stringify(statusEntries) !== JSON.stringify(finalStatus)
    || initialPatchFields.index_patch_digest !== finalPatchFields.index_patch_digest
    || initialPatchFields.worktree_patch_digest !== finalPatchFields.worktree_patch_digest
    || entriesDigest(entries) !== entriesDigest(finalEntries)
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
  const content = {
    project_path: scope.projectPath,
    policy,
    dirty,
    entries,
    ...initialPatchFields
  };
  const baseline: WorktreeBaseline = {
    schema_version: 1,
    ...content,
    captured_at: new Date().toISOString(),
    snapshot_digest: baselineDigest(content)
  };

  await writeJsonAtomic(join(scope.projectRoot, WORKTREE_BASELINE_PATH), baseline);
  return baseline;
}

export async function verifyWorktreePolicyOnResume(
  root: string,
  playbook: DokionPlaybook,
  hooks: WorktreePolicyCaptureHooks = {}
): Promise<void> {
  const scope = await resolveGitScope(root);
  const baseline = await readStoredBaseline(
    join(scope.projectRoot, WORKTREE_BASELINE_PATH)
  );
  assertBaselineIntegrity(baseline);
  if (
    (hooks.expectedSnapshotDigest && baseline.snapshot_digest !== hooks.expectedSnapshotDigest)
    || (hooks.expectedPolicy && baseline.policy !== hooks.expectedPolicy)
    || (hooks.expectedProjectPath && baseline.project_path !== hooks.expectedProjectPath)
  ) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Stored worktree baseline does not match the run state binding",
      {
        expected_snapshot_digest: hooks.expectedSnapshotDigest ?? null,
        observed_snapshot_digest: baseline.snapshot_digest,
        expected_policy: hooks.expectedPolicy ?? null,
        observed_policy: baseline.policy,
        expected_project_path: hooks.expectedProjectPath ?? null,
        observed_project_path: baseline.project_path
      }
    );
  }

  const policy = resolvePolicy(playbook);
  if (baseline.policy !== policy || baseline.project_path !== scope.projectPath) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Stored worktree baseline does not match the active project policy",
      {
        expected_policy: policy,
        observed_policy: baseline.policy,
        expected_project_path: scope.projectPath,
        observed_project_path: baseline.project_path
      }
    );
  }

  const [statusEntries, patches] = await Promise.all([
    readStatus(scope),
    capturePatches(scope)
  ]);
  if (policy === "clean-only" && statusEntries.length > 0) {
    throw new DokionError(
      "DIRTY_WORKTREE_BLOCKED",
      "Write-capable execution requires a clean worktree before resume",
      { policy, paths: statusEntries.map((entry) => entry.path) }
    );
  }

  const entries = await captureEntries(scope.projectRoot, statusEntries, false);
  await hooks.afterInitialCapture?.();
  const [finalStatus, finalPatches] = await Promise.all([
    readStatus(scope),
    capturePatches(scope)
  ]);
  const finalEntries = await captureEntries(scope.projectRoot, finalStatus, false);
  if (
    JSON.stringify(statusEntries) !== JSON.stringify(finalStatus)
    || sha256(patches.index) !== sha256(finalPatches.index)
    || sha256(patches.worktree) !== sha256(finalPatches.worktree)
    || entriesDigest(entries) !== entriesDigest(finalEntries)
  ) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Worktree changed during resume verification",
      { policy, paths: finalStatus.map((entry) => entry.path) }
    );
  }

  if (
    baseline.index_patch_digest !== sha256(patches.index)
    || baseline.worktree_patch_digest !== sha256(patches.worktree)
    || entriesDigest(baseline.entries) !== entriesDigest(entries)
  ) {
    throw new DokionError(
      "WORKTREE_SNAPSHOT_FAILED",
      "Worktree changed after the run baseline was captured",
      { policy, paths: statusEntries.map((entry) => entry.path) }
    );
  }
}
