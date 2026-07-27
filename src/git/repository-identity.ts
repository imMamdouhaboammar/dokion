import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { sha256 } from "../core/digest.ts";

export interface RepositoryIdentity {
  schema_version: 1;
  kind: "git" | "directory";
  canonical_root: string;
  root_digest: string;
  worktree_id: string;
  remote?: string;
  commit?: string;
  branch?: string;
  playbook_digest: string;
  captured_at: string;
}

export type RepositoryIdentityField =
  | "canonical_root"
  | "root_digest"
  | "worktree_id"
  | "remote"
  | "commit"
  | "branch"
  | "playbook_digest";

export interface RepositoryIdentityDifference {
  field: RepositoryIdentityField;
  expected: string | null;
  actual: string | null;
}

const COMPARISON_FIELDS: readonly RepositoryIdentityField[] = [
  "canonical_root",
  "root_digest",
  "worktree_id",
  "remote",
  "commit",
  "branch",
  "playbook_digest"
];

async function runGit(root: string, args: string[]): Promise<string | undefined> {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore"
  });
  const output = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const exitCode = await child.exited;
  if (exitCode !== 0) return undefined;
  const value = (await output).trim();
  return value || undefined;
}

function stripGitSuffix(path: string): string {
  return path.replace(/\.git\/?$/i, "").replace(/\/$/, "");
}

function localRemoteIdentity(remote: string): string {
  return `local:${sha256(remote)}`;
}

export function normalizeRemoteIdentity(remote: string): string {
  const value = remote.trim();
  if (!value) return localRemoteIdentity(value);

  if (value.includes("://")) {
    try {
      const url = new URL(value);
      if (url.protocol === "file:") return localRemoteIdentity(value);
      if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol)) return localRemoteIdentity(value);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      const protocol = url.protocol === "git:" ? "ssh:" : url.protocol;
      const path = stripGitSuffix(url.pathname).replace(/^\/+/, "");
      return `${protocol}//${url.host}${path ? `/${path}` : ""}`;
    } catch {
      return localRemoteIdentity(value);
    }
  }

  const scpLike = value.match(/^(?:[^@/:]+@)?([^:/]+):(.+)$/);
  if (scpLike && !isAbsolute(value) && !/^[A-Za-z]:[\\/]/.test(value)) {
    const host = scpLike[1]!;
    const path = stripGitSuffix(scpLike[2]!.replace(/^\/+/, ""));
    return `ssh://${host}/${path}`;
  }

  return localRemoteIdentity(value);
}

async function resolveGitDirectory(root: string, canonicalRoot: string): Promise<string | undefined> {
  const absolute = await runGit(root, ["rev-parse", "--path-format=absolute", "--git-dir"]);
  if (absolute) {
    try {
      return await realpath(absolute);
    } catch {
      return resolve(canonicalRoot, absolute);
    }
  }
  const fallback = await runGit(root, ["rev-parse", "--git-dir"]);
  if (!fallback) return undefined;
  const path = isAbsolute(fallback) ? fallback : resolve(canonicalRoot, fallback);
  try {
    return await realpath(path);
  } catch {
    return path;
  }
}

export async function captureRepositoryIdentity(root: string, playbookDigest: string): Promise<RepositoryIdentity> {
  const inputRoot = await realpath(root);
  const topLevel = await runGit(root, ["rev-parse", "--show-toplevel"]);
  const canonicalRoot = topLevel ? await realpath(topLevel) : inputRoot;
  const rootDigest = sha256(canonicalRoot);
  const capturedAt = new Date().toISOString();

  if (!topLevel) {
    return {
      schema_version: 1,
      kind: "directory",
      canonical_root: canonicalRoot,
      root_digest: rootDigest,
      worktree_id: rootDigest,
      playbook_digest: playbookDigest,
      captured_at: capturedAt
    };
  }

  const [commit, branch, remote, gitDirectory] = await Promise.all([
    runGit(root, ["rev-parse", "HEAD"]),
    runGit(root, ["branch", "--show-current"]),
    runGit(root, ["remote", "get-url", "origin"]),
    resolveGitDirectory(root, canonicalRoot)
  ]);

  return {
    schema_version: 1,
    kind: "git",
    canonical_root: canonicalRoot,
    root_digest: rootDigest,
    worktree_id: sha256(gitDirectory ?? canonicalRoot),
    ...(remote ? { remote: normalizeRemoteIdentity(remote) } : {}),
    ...(commit ? { commit } : {}),
    ...(branch ? { branch } : {}),
    playbook_digest: playbookDigest,
    captured_at: capturedAt
  };
}

export function compareRepositoryIdentities(
  expected: RepositoryIdentity,
  actual: RepositoryIdentity
): RepositoryIdentityDifference[] {
  return COMPARISON_FIELDS.flatMap((field) => {
    const expectedValue = expected[field] ?? null;
    const actualValue = actual[field] ?? null;
    return expectedValue === actualValue ? [] : [{ field, expected: expectedValue, actual: actualValue }];
  });
}
