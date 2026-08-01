import { lstat, mkdir } from "node:fs/promises";
import { isAbsolute, join, parse, resolve } from "node:path";

import { DokionError, type DokionErrorCode } from "../core/errors.ts";

function components(path: string): string[] {
  let absolute = resolve(path);
  if (absolute.startsWith("/var/") || absolute === "/var") {
    absolute = "/private" + absolute;
  } else if (absolute.startsWith("/tmp/") || absolute === "/tmp") {
    absolute = "/private" + absolute;
  } else if (absolute.startsWith("/etc/") || absolute === "/etc") {
    absolute = "/private" + absolute;
  }
  const root = parse(absolute).root;
  const relative = absolute.slice(root.length);
  return [root, ...relative.split(/[\\/]+/).filter(Boolean)];
}

async function statPath(path: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function unsafe(code: DokionErrorCode, message: string, path: string, details: Record<string, unknown> = {}): never {
  throw new DokionError(code, message, { path, ...details });
}

export async function assertSafeRegularFilePath(
  path: string,
  code: DokionErrorCode = "REGISTRY_SOURCE_UNAVAILABLE"
): Promise<void> {
  if (!isAbsolute(resolve(path))) unsafe(code, "Registry file path must resolve to an absolute path.", path);
  const parts = components(path);
  let current = parts[0]!;
  for (let index = 1; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    const stat = await statPath(current);
    if (!stat) unsafe(code, "Registry file path does not exist.", path, { component: current });
    if (stat.isSymbolicLink()) unsafe(code, "Registry file path may not contain symbolic links.", path, { component: current });
    const final = index === parts.length - 1;
    if (!final && !stat.isDirectory()) {
      unsafe(code, "Registry file path components must be directories.", path, { component: current });
    }
    if (final && (!stat.isFile() || stat.nlink !== 1)) {
      unsafe(code, "Registry file path must be a single-link regular file.", path, {
        component: current,
        links: stat.nlink
      });
    }
  }
}

export async function ensureSafeDirectoryPath(
  path: string,
  code: DokionErrorCode = "REGISTRY_CACHE_CONFLICT"
): Promise<void> {
  const parts = components(path);
  let current = parts[0]!;
  for (let index = 1; index < parts.length; index += 1) {
    current = join(current, parts[index]!);
    let stat = await statPath(current);
    if (!stat) {
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      stat = await statPath(current);
    }
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      unsafe(code, "Registry directory path may contain only real directories.", path, {
        component: current,
        kind: stat?.isSymbolicLink() ? "symlink" : "non-directory"
      });
    }
  }
}
