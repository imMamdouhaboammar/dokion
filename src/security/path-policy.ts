import { lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type PathPolicyDenialReason =
  | "ABSOLUTE_PATH"
  | "PARENT_TRAVERSAL"
  | "ALTERNATE_SEPARATOR"
  | "INVALID_PATH"
  | "INVALID_DECLARED_SCOPE"
  | "OUTSIDE_DECLARED_SCOPE"
  | "SYMLINK_ESCAPE"
  | "CASE_FOLD_COLLISION"
  | "ROOT_REPLACED"
  | "ROOT_UNAVAILABLE"
  | "UNSUPPORTED_FILESYSTEM_GUARANTEE";

export interface PathPolicyOptions {
  platform?: string;
  expectedCanonicalRoot?: string;
}

export interface PathPolicyDecision {
  allowed: boolean;
  platform: string;
  requested: string;
  attemptedScopes: string[];
  declaredScopes: string[];
  canonicalRoot: string | null;
  canonicalPath: string | null;
  reason: PathPolicyDenialReason | null;
  detail: string;
}

interface RootIdentity {
  canonical: string;
  device: number;
  inode: number;
}

interface CanonicalPathResult {
  canonicalPath?: string;
  reason?: PathPolicyDenialReason;
  detail?: string;
}

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:|\\\\)/;

function toPosix(value: string): string {
  return value.split(sep).join("/");
}

function fold(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

function insideRoot(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function classifyPath(value: string, field: "requested" | "scope"): PathPolicyDenialReason | null {
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
    return field === "scope" ? "INVALID_DECLARED_SCOPE" : "INVALID_PATH";
  }
  if (isAbsolute(value) || WINDOWS_ABSOLUTE.test(value)) return "ABSOLUTE_PATH";
  if (value.includes("\\")) return "ALTERNATE_SEPARATOR";

  const trailingSlash = field === "scope" && value.endsWith("/");
  const normalized = trailingSlash ? value.slice(0, -1) : value;
  if (!normalized || normalized.includes("//")) {
    return field === "scope" ? "INVALID_DECLARED_SCOPE" : "INVALID_PATH";
  }
  const segments = normalized.split("/");
  if (segments.includes("..")) return "PARENT_TRAVERSAL";
  if (segments.includes(".")) {
    return field === "scope" ? "INVALID_DECLARED_SCOPE" : "INVALID_PATH";
  }
  return null;
}

async function rootIdentity(root: string): Promise<RootIdentity> {
  const [canonical, metadata] = await Promise.all([realpath(root), lstat(root)]);
  return { canonical, device: metadata.dev, inode: metadata.ino };
}

function sameIdentity(left: RootIdentity, right: RootIdentity): boolean {
  return left.canonical === right.canonical
    && left.device === right.device
    && left.inode === right.inode;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

async function canonicalizeWithinRoot(
  canonicalRoot: string,
  requested: string
): Promise<CanonicalPathResult> {
  const segments = requested.split("/");
  let current = canonicalRoot;
  let canonicalSegments: string[] = [];
  let missing = false;

  for (const [index, segment] of segments.entries()) {
    if (missing) {
      current = join(current, segment);
      canonicalSegments.push(segment);
      continue;
    }

    let entries: string[];
    try {
      entries = await readdir(current);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT") {
        missing = true;
        current = join(current, segment);
        canonicalSegments.push(segment);
        continue;
      }
      if (code === "ENOTDIR") {
        return { reason: "INVALID_PATH", detail: `Path segment ${segments[index - 1]} is not a directory` };
      }
      return { reason: "UNSUPPORTED_FILESYSTEM_GUARANTEE", detail: "Directory entries could not be inspected" };
    }

    const foldedMatches = entries.filter((entry) => fold(entry) === fold(segment));
    const exact = entries.includes(segment) ? segment : undefined;
    if (foldedMatches.length > 1 || (!exact && foldedMatches.length > 0)) {
      return {
        reason: "CASE_FOLD_COLLISION",
        detail: `Path segment ${segment} collides with ${foldedMatches.sort().join(", ")}`
      };
    }

    if (!exact) {
      missing = true;
      current = join(current, segment);
      canonicalSegments.push(segment);
      continue;
    }

    const candidate = join(current, exact);
    let metadata;
    try {
      metadata = await lstat(candidate);
    } catch {
      return {
        reason: "UNSUPPORTED_FILESYSTEM_GUARANTEE",
        detail: `Path segment ${segment} changed during evaluation`
      };
    }

    if (metadata.isSymbolicLink()) {
      let resolved: string;
      try {
        resolved = await realpath(candidate);
      } catch {
        return { reason: "SYMLINK_ESCAPE", detail: `Symlink ${segment} cannot be resolved safely` };
      }
      if (!insideRoot(canonicalRoot, resolved)) {
        return { reason: "SYMLINK_ESCAPE", detail: `Symlink ${segment} resolves outside the repository` };
      }
      current = resolved;
      const resolvedRelative = toPosix(relative(canonicalRoot, resolved));
      canonicalSegments = resolvedRelative ? resolvedRelative.split("/") : [];
      continue;
    }

    current = candidate;
    canonicalSegments.push(exact);
  }

  if (!insideRoot(canonicalRoot, current)) {
    return { reason: "SYMLINK_ESCAPE", detail: "Canonical path escaped the repository root" };
  }

  return { canonicalPath: canonicalSegments.join("/") };
}

function scopeMatches(path: string, scope: string): boolean {
  if (scope.startsWith("*")) return path.endsWith(scope.slice(1));
  if (scope.endsWith("/")) {
    const directory = scope.slice(0, -1);
    return path === directory || path.startsWith(scope);
  }
  return path === scope;
}

async function canonicalizeScopes(
  canonicalRoot: string,
  scopes: readonly string[]
): Promise<{ scopes?: string[]; reason?: PathPolicyDenialReason; detail?: string }> {
  const canonical: string[] = [];
  for (const scope of scopes) {
    if (scope.startsWith("*") && !scope.includes("/") && !scope.includes("\\")) {
      if (scope.length === 1 || scope.includes("\u0000")) {
        return { reason: "INVALID_DECLARED_SCOPE", detail: `Declared scope ${scope} is invalid` };
      }
      canonical.push(scope);
      continue;
    }

    const syntaxReason = classifyPath(scope, "scope");
    if (syntaxReason) {
      return { reason: syntaxReason, detail: `Declared scope ${scope} is invalid` };
    }
    const directory = scope.endsWith("/");
    const base = directory ? scope.slice(0, -1) : scope;
    const evaluated = await canonicalizeWithinRoot(canonicalRoot, base);
    if (!evaluated.canonicalPath) return evaluated;
    canonical.push(`${evaluated.canonicalPath}${directory ? "/" : ""}`);
  }
  return { scopes: [...new Set(canonical)].sort() };
}

function denial(input: {
  platform: string;
  requested: string;
  attemptedScopes: readonly string[];
  declaredScopes?: readonly string[];
  canonicalRoot?: string | null;
  canonicalPath?: string | null;
  reason: PathPolicyDenialReason;
  detail: string;
}): PathPolicyDecision {
  return {
    allowed: false,
    platform: input.platform,
    requested: input.requested,
    attemptedScopes: [...input.attemptedScopes],
    declaredScopes: [...(input.declaredScopes ?? input.attemptedScopes)],
    canonicalRoot: input.canonicalRoot ?? null,
    canonicalPath: input.canonicalPath ?? null,
    reason: input.reason,
    detail: input.detail
  };
}

export async function evaluateRepositoryPath(
  root: string,
  requested: string,
  declaredScopes: readonly string[],
  options: PathPolicyOptions = {}
): Promise<PathPolicyDecision> {
  const platform = options.platform ?? process.platform;
  const attemptedScopes = [...declaredScopes];

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      reason: "UNSUPPORTED_FILESYSTEM_GUARANTEE",
      detail: `No proven repository path policy exists for platform ${platform}`
    });
  }

  let before: RootIdentity;
  try {
    before = await rootIdentity(root);
  } catch {
    return denial({
      platform,
      requested,
      attemptedScopes,
      reason: "ROOT_UNAVAILABLE",
      detail: "Repository root cannot be resolved"
    });
  }

  if (options.expectedCanonicalRoot !== undefined) {
    const expected = resolve(options.expectedCanonicalRoot);
    if (before.canonical !== expected) {
      return denial({
        platform,
        requested,
        attemptedScopes,
        canonicalRoot: before.canonical,
        reason: "ROOT_REPLACED",
        detail: `Repository root changed from ${expected} to ${before.canonical}`
      });
    }
  }

  const requestReason = classifyPath(requested, "requested");
  if (requestReason) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      canonicalRoot: before.canonical,
      reason: requestReason,
      detail: `Requested path ${requested || "<empty>"} is invalid`
    });
  }

  const scopeEvaluation = await canonicalizeScopes(before.canonical, declaredScopes);
  if (!scopeEvaluation.scopes) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      canonicalRoot: before.canonical,
      reason: scopeEvaluation.reason ?? "INVALID_DECLARED_SCOPE",
      detail: scopeEvaluation.detail ?? "Declared scopes could not be canonicalized"
    });
  }

  const pathEvaluation = await canonicalizeWithinRoot(before.canonical, requested);
  if (!pathEvaluation.canonicalPath) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      declaredScopes: scopeEvaluation.scopes,
      canonicalRoot: before.canonical,
      reason: pathEvaluation.reason ?? "INVALID_PATH",
      detail: pathEvaluation.detail ?? "Requested path could not be canonicalized"
    });
  }

  let after: RootIdentity;
  try {
    after = await rootIdentity(root);
  } catch {
    return denial({
      platform,
      requested,
      attemptedScopes,
      declaredScopes: scopeEvaluation.scopes,
      canonicalRoot: before.canonical,
      reason: "ROOT_REPLACED",
      detail: "Repository root disappeared during path evaluation"
    });
  }

  if (!sameIdentity(before, after)) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      declaredScopes: scopeEvaluation.scopes,
      canonicalRoot: after.canonical,
      reason: "ROOT_REPLACED",
      detail: "Repository root identity changed during path evaluation"
    });
  }

  const canonicalPath = pathEvaluation.canonicalPath;
  const allowed = scopeEvaluation.scopes.some((scope) => scopeMatches(canonicalPath, scope));
  if (!allowed) {
    return denial({
      platform,
      requested,
      attemptedScopes,
      declaredScopes: scopeEvaluation.scopes,
      canonicalRoot: before.canonical,
      canonicalPath,
      reason: "OUTSIDE_DECLARED_SCOPE",
      detail: `Canonical path ${canonicalPath} is outside declared scopes`
    });
  }

  return {
    allowed: true,
    platform,
    requested,
    attemptedScopes,
    declaredScopes: scopeEvaluation.scopes,
    canonicalRoot: before.canonical,
    canonicalPath,
    reason: null,
    detail: `Canonical path ${canonicalPath} is within a declared scope`
  };
}
