import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readdir, rm, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";
import { ensureSafeDirectoryPath } from "./filesystem-safety.ts";

const LOCK_WAIT_MILLISECONDS = 10;
const LOCK_MAXIMUM_ATTEMPTS = 500;
const LOCK_STALE_MILLISECONDS = 5 * 60 * 1000;
const TEMP_STALE_MILLISECONDS = 24 * 60 * 60 * 1000;

function digestHex(digest: `sha256:${string}`): string {
  const hex = digest.slice("sha256:".length);
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new DokionError("REGISTRY_CACHE_CONFLICT", "Immutable cache digest is invalid.", { digest });
  }
  return hex;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function removeStaleLock(path: string, now: number): Promise<boolean> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new DokionError("REGISTRY_CACHE_LOCKED", "Registry cache lock path is not a regular file.", { path });
  }
  if (now - stat.mtimeMs <= LOCK_STALE_MILLISECONDS) return false;
  await unlink(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
  return true;
}

export async function withRegistryArtifactLock<T>(
  cacheRoot: string,
  digest: `sha256:${string}`,
  action: () => Promise<T>
): Promise<T> {
  const lockDirectory = join(resolve(cacheRoot), ".locks");
  await ensureSafeDirectoryPath(lockDirectory, "REGISTRY_CACHE_LOCKED");
  const lockPath = join(lockDirectory, `${digestHex(digest)}.lock`);
  let handle;

  for (let attempt = 0; attempt < LOCK_MAXIMUM_ATTEMPTS; attempt += 1) {
    try {
      handle = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        created_at: new Date().toISOString(),
        nonce: randomUUID()
      }));
      await handle.sync();
      break;
    } catch (error) {
      await handle?.close().catch(() => undefined);
      handle = undefined;
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw new DokionError("REGISTRY_CACHE_LOCKED", "Registry cache lock could not be acquired safely.", {
          path: lockPath,
          errorCode: code ?? "UNKNOWN",
          cause: error instanceof Error ? error.message : String(error)
        });
      }
      if (await removeStaleLock(lockPath, Date.now())) continue;
      await delay(LOCK_WAIT_MILLISECONDS);
    }
  }

  if (!handle) {
    throw new DokionError("REGISTRY_CACHE_LOCKED", "Registry cache lock acquisition timed out.", {
      path: lockPath,
      attempts: LOCK_MAXIMUM_ATTEMPTS
    });
  }

  try {
    return await action();
  } finally {
    await handle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}

export function registryArtifactTemporaryDirectory(cacheRoot: string): string {
  return join(resolve(cacheRoot), ".tmp");
}

export async function cleanupStaleRegistryArtifactTemps(
  cacheRoot: string,
  maximumAgeMilliseconds = TEMP_STALE_MILLISECONDS,
  now = Date.now()
): Promise<string[]> {
  const directory = registryArtifactTemporaryDirectory(cacheRoot);
  await ensureSafeDirectoryPath(directory);
  const removed: string[] = [];
  for (const name of await readdir(directory)) {
    if (!name.includes(".dokion-tmp-")) continue;
    const path = join(directory, name);
    const stat = await lstat(path).catch(() => null);
    if (!stat) continue;
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new DokionError("REGISTRY_CACHE_CONFLICT", "Registry cache temporary path is not a regular file.", { path });
    }
    if (now - stat.mtimeMs <= maximumAgeMilliseconds) continue;
    await rm(path, { force: true });
    removed.push(name);
  }
  return removed.sort();
}
