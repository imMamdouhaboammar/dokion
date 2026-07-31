import { lstat, opendir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";

export type IgnoredFileExclusionReason =
  | "NOT_IGNORED"
  | "MISSING"
  | "UNSUPPORTED_ENTRY"
  | "BLOCKED_DEPENDENCY_TREE"
  | "BLOCKED_CACHE"
  | "BLOCKED_CREDENTIAL"
  | "BLOCKED_GENERATED_BULK"
  | "BLOCKED_RUNTIME_PATH";

export type IgnoredFileLimitReason =
  | "FILE_COUNT_LIMIT"
  | "FILE_BYTES_LIMIT"
  | "TOTAL_BYTES_LIMIT"
  | "ENTRY_SCAN_LIMIT"
  | "INVALID_DECLARATION"
  | "SYMLINK_ESCAPE"
  | "GIT_IGNORE_UNAVAILABLE"
  | "FILE_CHANGED_DURING_SCAN"
  | "ROOT_REPLACED";

export interface IgnoredFilePolicy {
  declaredPaths: readonly string[];
  maxFiles: number;
  maxTotalBytes: number;
  maxFileBytes?: number;
  maxEntries?: number;
}

export interface IgnoredFileRecord {
  path: string;
  size: number;
  mode: number;
  modifiedAtMs: number;
}

export interface IgnoredFileExclusion {
  path: string;
  reason: IgnoredFileExclusionReason;
}

export interface IgnoredFileCollection {
  canonicalRoot: string;
  files: IgnoredFileRecord[];
  excluded: IgnoredFileExclusion[];
  fileCount: number;
  totalBytes: number;
  limits: {
    maxFiles: number;
    maxTotalBytes: number;
    maxFileBytes: number;
    maxEntries: number;
  };
}

const HARD_MAX_FILES = 10_000;
const HARD_MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const HARD_MAX_FILE_BYTES = 64 * 1024 * 1024;
const HARD_MAX_ENTRIES = 40_000;
const WINDOWS_PATH = /^(?:[A-Za-z]:|\\\\)/;

function fail(
  reason: IgnoredFileLimitReason,
  message: string,
  details: Record<string, unknown> = {}
): never {
  throw new DokionError("WORKTREE_SNAPSHOT_FAILED", message, { reason, ...details });
}

function requireBound(field: string, value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    fail("INVALID_DECLARATION", `${field} must be an integer between 0 and ${maximum}`, { field });
  }
  return value;
}


function safeDeclaration(path: string): string {
  if (!path || path.includes("\u0000") || isAbsolute(path) || WINDOWS_PATH.test(path)) {
    fail("INVALID_DECLARATION", `Ignored path declaration is unsafe: ${path || "<empty>"}`, { path });
  }
  if (path.includes("\\")) {
    fail("INVALID_DECLARATION", `Ignored path uses an alternate separator: ${path}`, { path });
  }
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = normalized.split("/");
  if (!normalized || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    fail("INVALID_DECLARATION", `Ignored path declaration is ambiguous: ${path}`, { path });
  }
  return normalized;
}

function blockedReason(path: string): IgnoredFileExclusionReason | undefined {
  const segments = path.toLowerCase().split("/");
  const base = segments.at(-1) ?? "";
  if (segments.some((segment) => ["node_modules", "bower_components", "vendor", ".venv", "venv", "site-packages"].includes(segment))) {
    return "BLOCKED_DEPENDENCY_TREE";
  }
  if (segments.some((segment) => [".cache", "cache", "caches", ".turbo", ".parcel-cache", ".pytest_cache", "__pycache__"].includes(segment))) {
    return "BLOCKED_CACHE";
  }
  if (segments.some((segment) => ["dist", "build", "coverage", ".next", "out", "target", "tmp", "temp"].includes(segment))) {
    return "BLOCKED_GENERATED_BULK";
  }
  if (segments.some((segment) => [".git", ".dokion"].includes(segment))) {
    return "BLOCKED_RUNTIME_PATH";
  }

  const safeEnvTemplate = [".env.example", ".env.sample", ".env.template"].includes(base);
  const credentialName = base === ".env"
    || (base.startsWith(".env.") && !safeEnvTemplate)
    || [".npmrc", ".pypirc", "credentials", "credentials.json", "secrets", "secrets.json"].includes(base);
  const credentialExtension = [".pem", ".key", ".p12", ".pfx", ".keystore"]
    .some((extension) => base.endsWith(extension));
  if (credentialName || credentialExtension || segments.some((segment) => [".ssh", ".aws", ".gnupg"].includes(segment))) {
    return "BLOCKED_CREDENTIAL";
  }
  return undefined;
}

function insideRoot(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function isGitIgnored(root: string, path: string): Promise<boolean> {
  const child = Bun.spawn(["git", "check-ignore", "-q", "--", path], {
    cwd: root,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe"
  });
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode === 0) return true;
  if (exitCode === 1) return false;
  fail("GIT_IGNORE_UNAVAILABLE", "git check-ignore failed", {
    path,
    exitCode,
    stderr: stderr.slice(0, 500)
  });
}

async function sortedDirectoryEntries(path: string, maxEntries: number): Promise<string[]> {
  const directory = await opendir(path);
  const entries: string[] = [];
  for await (const entry of directory) {
    entries.push(entry.name);
    if (entries.length > maxEntries) {
      fail("ENTRY_SCAN_LIMIT", "Ignored directory entry limit exceeded", {
        path,
        maxEntries
      });
    }
  }
  return entries.sort();
}

interface CollectionState {
  canonicalRoot: string;
  limits: IgnoredFileCollection["limits"];
  files: Map<string, IgnoredFileRecord>;
  exclusions: Map<string, IgnoredFileExclusion>;
  visited: Set<string>;
  totalBytes: number;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function exclude(
  state: CollectionState,
  path: string,
  reason: IgnoredFileExclusionReason
): void {
  if (!state.exclusions.has(path)) state.exclusions.set(path, { path, reason });
}

function markVisited(state: CollectionState, path: string): boolean {
  if (state.visited.has(path)) return false;
  state.visited.add(path);
  if (state.visited.size > state.limits.maxEntries) {
    fail("ENTRY_SCAN_LIMIT", "Ignored path scan exceeded the entry limit", {
      path,
      maxEntries: state.limits.maxEntries
    });
  }
  return true;
}

async function collectPath(state: CollectionState, path: string): Promise<void> {
  if (!markVisited(state, path)) return;
  const blocked = blockedReason(path);
  if (blocked) {
    exclude(state, path, blocked);
    return;
  }

  const absolute = join(state.canonicalRoot, path);
  let before;
  try {
    before = await lstat(absolute);
  } catch (error) {
    if (isMissing(error)) {
      exclude(state, path, "MISSING");
      return;
    }
    throw error;
  }

  if (before.isSymbolicLink()) {
    let resolved: string;
    try {
      resolved = await realpath(absolute);
    } catch {
      fail("SYMLINK_ESCAPE", "Ignored path symlink cannot be resolved safely", { path });
    }
    if (!insideRoot(state.canonicalRoot, resolved)) {
      fail("SYMLINK_ESCAPE", "Ignored path symlink resolves outside the repository", {
        path,
        resolved
      });
    }
    exclude(state, path, "UNSUPPORTED_ENTRY");
    return;
  }

  if (before.isDirectory()) {
    const remaining = state.limits.maxEntries - state.visited.size;
    const entries = await sortedDirectoryEntries(absolute, remaining);
    for (const entry of entries) {
      await collectPath(state, `${path}/${entry}`);
    }
    return;
  }

  if (!before.isFile()) {
    exclude(state, path, "UNSUPPORTED_ENTRY");
    return;
  }

  if (before.size > state.limits.maxFileBytes) {
    fail("FILE_BYTES_LIMIT", "Ignored file exceeds the per-file byte limit", {
      path,
      size: before.size,
      maxFileBytes: state.limits.maxFileBytes
    });
  }

  const ignored = await isGitIgnored(state.canonicalRoot, path);
  let after;
  try {
    after = await lstat(absolute);
  } catch {
    fail("FILE_CHANGED_DURING_SCAN", "Ignored file disappeared during collection", { path });
  }
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs
    || before.mode !== after.mode
  ) {
    fail("FILE_CHANGED_DURING_SCAN", "Ignored file changed during collection", { path });
  }

  if (!ignored) {
    exclude(state, path, "NOT_IGNORED");
    return;
  }
  if (state.files.size + 1 > state.limits.maxFiles) {
    fail("FILE_COUNT_LIMIT", "Ignored file collection exceeds the file-count limit", {
      path,
      maxFiles: state.limits.maxFiles
    });
  }
  if (state.totalBytes + before.size > state.limits.maxTotalBytes) {
    fail("TOTAL_BYTES_LIMIT", "Ignored file collection exceeds the total-byte limit", {
      path,
      totalBytes: state.totalBytes + before.size,
      maxTotalBytes: state.limits.maxTotalBytes
    });
  }

  state.files.set(path, {
    path,
    size: before.size,
    mode: before.mode & 0o777,
    modifiedAtMs: before.mtimeMs
  });
  state.totalBytes += before.size;
}

async function assertGitRepository(root: string): Promise<void> {
  const child = Bun.spawn(["git", "rev-parse", "--is-inside-work-tree"], {
    cwd: root,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0 || stdout.trim() !== "true") {
    fail("GIT_IGNORE_UNAVAILABLE", "Ignored file policy requires a Git worktree", {
      exitCode,
      stderr: stderr.slice(0, 500)
    });
  }
}

export async function collectDeclaredIgnoredFiles(
  root: string,
  policy: IgnoredFilePolicy
): Promise<IgnoredFileCollection> {
  const maxFiles = requireBound("maxFiles", policy.maxFiles, HARD_MAX_FILES);
  const maxTotalBytes = requireBound("maxTotalBytes", policy.maxTotalBytes, HARD_MAX_TOTAL_BYTES);
  const maxFileBytes = requireBound(
    "maxFileBytes",
    policy.maxFileBytes ?? Math.min(maxTotalBytes, HARD_MAX_FILE_BYTES),
    HARD_MAX_FILE_BYTES
  );
  const defaultEntries = Math.min(HARD_MAX_ENTRIES, Math.max(100, maxFiles * 4));
  const maxEntries = requireBound("maxEntries", policy.maxEntries ?? defaultEntries, HARD_MAX_ENTRIES);

  if (policy.declaredPaths.length > maxEntries) {
    fail("ENTRY_SCAN_LIMIT", "Ignored path declaration count exceeds the entry limit", {
      declaredPaths: policy.declaredPaths.length,
      maxEntries
    });
  }

  const rootInput = resolve(root);
  let canonicalRoot: string;
  let rootBefore;
  try {
    [canonicalRoot, rootBefore] = await Promise.all([realpath(rootInput), lstat(rootInput)]);
  } catch {
    fail("INVALID_DECLARATION", "Repository root cannot be resolved", { root: rootInput });
  }
  await assertGitRepository(canonicalRoot);

  const state: CollectionState = {
    canonicalRoot,
    limits: { maxFiles, maxTotalBytes, maxFileBytes, maxEntries },
    files: new Map(),
    exclusions: new Map(),
    visited: new Set(),
    totalBytes: 0
  };

  const declarations = [...new Set(policy.declaredPaths.map(safeDeclaration))].sort();
  for (const declaration of declarations) {
    const candidate = resolve(canonicalRoot, declaration);
    if (!insideRoot(canonicalRoot, candidate)) {
      fail("INVALID_DECLARATION", "Ignored path escapes the repository root", {
        path: declaration
      });
    }
    await collectPath(state, declaration);
  }

  let rootAfter;
  let canonicalAfter: string;
  try {
    [canonicalAfter, rootAfter] = await Promise.all([realpath(rootInput), lstat(rootInput)]);
  } catch {
    fail("ROOT_REPLACED", "Repository root disappeared during ignored file collection");
  }
  if (
    canonicalAfter !== canonicalRoot
    || rootAfter.dev !== rootBefore.dev
    || rootAfter.ino !== rootBefore.ino
  ) {
    fail("ROOT_REPLACED", "Repository root changed during ignored file collection", {
      before: canonicalRoot,
      after: canonicalAfter
    });
  }

  const files = [...state.files.values()].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const excluded = [...state.exclusions.values()].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1
      : left.reason < right.reason ? -1 : left.reason > right.reason ? 1 : 0);

  return {
    canonicalRoot,
    files,
    excluded,
    fileCount: files.length,
    totalBytes: state.totalBytes,
    limits: state.limits
  };
}
