import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

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

export async function writeTextAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;

  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "w" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await writeTextAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}
