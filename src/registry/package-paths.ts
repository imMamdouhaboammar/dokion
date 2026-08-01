import { DokionError } from "../core/errors.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";

const ARCHIVE_ROOT = "dokion-package/";
const ENCODED_SEPARATOR_OR_TRAVERSAL = /%(?:00|2e|2f|5c)/i;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:/;

export function normalizePackagePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", "Package paths must be non-empty strings.", { path: input });
  }
  if (input.includes("\0") || input.includes("\\") || input.startsWith("/") || WINDOWS_ABSOLUTE.test(input)) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", `Unsafe package path: ${input}`, { path: input });
  }
  if (ENCODED_SEPARATOR_OR_TRAVERSAL.test(input)) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", `Encoded separators or traversal are forbidden: ${input}`, {
      path: input
    });
  }

  const segments = input.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", `Ambiguous or traversing package path: ${input}`, {
      path: input
    });
  }

  const normalized = input.normalize("NFC");
  if (Buffer.byteLength(normalized, "utf8") > REGISTRY_PACKAGE_LIMITS.maximumPathBytes) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", `Package path exceeds the ${REGISTRY_PACKAGE_LIMITS.maximumPathBytes}-byte limit.`, {
      path: input
    });
  }
  return normalized;
}

export function packagePathFromArchiveEntry(entryPath: string): string {
  if (!entryPath.startsWith(ARCHIVE_ROOT) || entryPath === ARCHIVE_ROOT) {
    throw new DokionError("REGISTRY_PACKAGE_PATH_INVALID", `Archive entry must be rooted at ${ARCHIVE_ROOT}`, {
      path: entryPath
    });
  }
  return normalizePackagePath(entryPath.slice(ARCHIVE_ROOT.length));
}

export function archivePathForPackageFile(path: string): string {
  return `${ARCHIVE_ROOT}${normalizePackagePath(path)}`;
}

export class PackagePathRegistry {
  readonly #exact = new Map<string, number>();
  readonly #caseFolded = new Map<string, { path: string; index: number }>();
  #size = 0;

  get size(): number {
    return this.#size;
  }

  add(input: string): string {
    const path = normalizePackagePath(input);
    const index = this.#size;
    const previousExact = this.#exact.get(path);
    if (previousExact !== undefined) {
      throw new DokionError("REGISTRY_PACKAGE_PATH_DUPLICATE", `Duplicate package path: ${path}`, {
        path,
        firstIndex: previousExact,
        duplicateIndex: index
      });
    }

    const folded = path.toLowerCase();
    const previousFolded = this.#caseFolded.get(folded);
    if (previousFolded && previousFolded.path !== path) {
      throw new DokionError("REGISTRY_PACKAGE_CASE_COLLISION", `Case-colliding package paths: ${previousFolded.path} and ${path}`, {
        firstPath: previousFolded.path,
        secondPath: path,
        firstIndex: previousFolded.index,
        secondIndex: index
      });
    }

    this.#exact.set(path, index);
    this.#caseFolded.set(folded, { path, index });
    this.#size += 1;
    return path;
  }
}

export function assertUniquePackagePaths(paths: readonly string[]): void {
  const registry = new PackagePathRegistry();
  for (const path of paths) registry.add(path);
}
