import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";

import { createAtomicWriteMetadata, type AtomicWriteKind } from "./atomic-file.ts";
import { DokionError } from "./errors.ts";

export async function readJson<T>(path: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw error;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new DokionError("INVALID_JSON", `Invalid JSON at ${path}`, {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function writeTextAtomic(
  path: string,
  content: string,
  kind: AtomicWriteKind = "text"
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  const metadataPath = `${temporaryPath}.meta.json`;
  const metadata = createAtomicWriteMetadata(basename(path), content, kind);
  let temporaryCreated = false;
  let metadataCreated = false;

  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    temporaryCreated = true;
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    metadataCreated = true;
    await rename(temporaryPath, path);
    temporaryCreated = false;
    await rm(metadataPath);
    metadataCreated = false;
  } catch (error) {
    if (temporaryCreated) await rm(temporaryPath, { force: true });
    if (metadataCreated) await rm(metadataPath, { force: true });
    throw error;
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`, "json");
}
