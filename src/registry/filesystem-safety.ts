import type { DokionErrorCode } from "../core/errors.ts";
import {
  assertSafeRegularFilePath as assertSafeRegularFilePathWithCode,
  ensureSafeDirectoryPath as ensureSafeDirectoryPathWithCode
} from "../security/filesystem-safety.ts";

export async function assertSafeRegularFilePath(
  path: string,
  code: DokionErrorCode = "REGISTRY_SOURCE_UNAVAILABLE"
): Promise<void> {
  await assertSafeRegularFilePathWithCode(path, code);
}

export async function ensureSafeDirectoryPath(
  path: string,
  code: DokionErrorCode = "REGISTRY_CACHE_CONFLICT"
): Promise<void> {
  await ensureSafeDirectoryPathWithCode(path, code);
}
