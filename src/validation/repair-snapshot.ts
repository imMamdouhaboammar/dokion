import { chmod, lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

import { sha256 } from "../core/digest.ts";

export type RepairSnapshotEntry =
  | { kind: "file"; digest: string; content: string; mode: number }
  | { kind: "symlink"; digest: string; target: string; mode: number }
  | { kind: "missing"; digest: string };

export interface RepairSnapshot {
  capturedAt: string;
  files: Record<string, RepairSnapshotEntry>;
}

export interface RepairDelta {
  changedPaths: string[];
  addedPaths: string[];
  modifiedPaths: string[];
  deletedPaths: string[];
  changedTestPaths: string[];
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function assertRepositoryPath(path: string): void {
  if (isAbsolute(path) || path.split("/").includes("..")) {
    throw new Error(`Unsafe repository path returned by git: ${path}`);
  }
}

function isDokionOwned(path: string): boolean {
  return path === "HARDENING.md" || path === ".dokion" || path.startsWith(".dokion/") || path === ".git" || path.startsWith(".git/");
}

export function isTestPath(path: string): boolean {
  return /(^|\/)(?:test|tests|__tests__)(\/|$)|\.(?:test|spec)\.[^/]+$/i.test(path);
}

async function gitPathList(root: string): Promise<string[]> {
  const child = Bun.spawn(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).arrayBuffer() : new ArrayBuffer(0),
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) throw new Error(`git ls-files failed: ${stderr}`);

  return new TextDecoder()
    .decode(stdout)
    .split("\0")
    .filter(Boolean)
    .filter((path) => !isDokionOwned(path))
    .sort();
}

async function captureEntry(root: string, path: string): Promise<RepairSnapshotEntry> {
  assertRepositoryPath(path);
  const absolute = join(root, path);
  try {
    const stat = await lstat(absolute);
    const mode = stat.mode & 0o777;
    if (stat.isSymbolicLink()) {
      const target = await readlink(absolute);
      return { kind: "symlink", target, mode, digest: sha256(`symlink:${target}:${mode}`) };
    }
    if (!stat.isFile()) {
      throw new Error(`Unsupported repository entry for repair snapshot: ${path}`);
    }
    const bytes = await readFile(absolute);
    return { kind: "file", content: bytes.toString("base64"), mode, digest: sha256(bytes) };
  } catch (error) {
    if (isMissing(error)) return { kind: "missing", digest: sha256("missing") };
    throw error;
  }
}

export async function captureRepairSnapshot(root: string): Promise<RepairSnapshot> {
  const paths = await gitPathList(root);
  const files: Record<string, RepairSnapshotEntry> = {};
  for (const path of paths) files[path] = await captureEntry(root, path);
  return { capturedAt: new Date().toISOString(), files };
}

function sameEntry(left: RepairSnapshotEntry | undefined, right: RepairSnapshotEntry | undefined): boolean {
  if (!left || !right) return left === right;
  return left.kind === right.kind && left.digest === right.digest && (left.kind === "missing" || right.kind === "missing" || left.mode === right.mode);
}

function exists(entry: RepairSnapshotEntry | undefined): boolean {
  return Boolean(entry && entry.kind !== "missing");
}

export function diffRepairSnapshots(before: RepairSnapshot, after: RepairSnapshot): RepairDelta {
  const changedPaths = Array.from(new Set([...Object.keys(before.files), ...Object.keys(after.files)]))
    .filter((path) => !sameEntry(before.files[path], after.files[path]))
    .sort();
  const addedPaths = changedPaths.filter((path) => !exists(before.files[path]) && exists(after.files[path]));
  const deletedPaths = changedPaths.filter((path) => exists(before.files[path]) && !exists(after.files[path]));
  const modifiedPaths = changedPaths.filter((path) => exists(before.files[path]) && exists(after.files[path]));
  const changedTestPaths = changedPaths.filter((path) => isTestPath(path) && exists(after.files[path]));
  return { changedPaths, addedPaths, modifiedPaths, deletedPaths, changedTestPaths };
}

async function restoreEntry(root: string, path: string, entry: RepairSnapshotEntry | undefined): Promise<void> {
  assertRepositoryPath(path);
  const absolute = join(root, path);
  if (!entry || entry.kind === "missing") {
    await rm(absolute, { recursive: true, force: true });
    return;
  }

  await mkdir(dirname(absolute), { recursive: true });
  await rm(absolute, { recursive: true, force: true });
  if (entry.kind === "symlink") {
    await symlink(entry.target, absolute);
    return;
  }
  await writeFile(absolute, Buffer.from(entry.content, "base64"));
  await chmod(absolute, entry.mode);
}

export async function restoreRepairSnapshot(root: string, before: RepairSnapshot, delta: RepairDelta): Promise<void> {
  for (const path of delta.changedPaths) await restoreEntry(root, path, before.files[path]);
}

export function snapshotText(entry: RepairSnapshotEntry | undefined): string | undefined {
  if (!entry || entry.kind !== "file") return undefined;
  const bytes = Buffer.from(entry.content, "base64");
  if (bytes.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function entryLabel(entry: RepairSnapshotEntry | undefined): string {
  if (!entry || entry.kind === "missing") return "<absent>";
  if (entry.kind === "symlink") return `<symlink:${entry.target}>`;
  return snapshotText(entry) ?? `<binary:${entry.digest}>`;
}

export function renderRepairDelta(before: RepairSnapshot, after: RepairSnapshot, delta: RepairDelta): string {
  const lines = ["# Dokion Repair Delta v1", ""];
  for (const path of delta.changedPaths) {
    const status = delta.addedPaths.includes(path) ? "A" : delta.deletedPaths.includes(path) ? "D" : "M";
    lines.push(`## ${status} ${path}`, "", "### BEFORE", entryLabel(before.files[path]), "", "### AFTER", entryLabel(after.files[path]), "");
  }
  return `${lines.join("\n")}\n`;
}
