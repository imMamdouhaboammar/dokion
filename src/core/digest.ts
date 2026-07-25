import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function sha256(content: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export async function sha256File(path: string): Promise<string> {
  return sha256(await readFile(path));
}
