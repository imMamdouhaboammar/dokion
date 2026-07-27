import { appendFile, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

import { sha256 } from "./digest.ts";

export const ATOMIC_RECOVERY_LOG_PATH = ".dokion/recovery/atomic-writes.ndjson";
export const ATOMIC_RECOVERY_QUARANTINE_PATH = ".dokion/recovery/atomic-writes";

export type AtomicWriteKind = "json" | "text";
export type AtomicRecoveryAction = "RECOVERED" | "QUARANTINED" | "DISCARDED_DUPLICATE";
export type AtomicRecoveryReason =
  | "VERIFIED_TEMPORARY"
  | "INVALID_JSON"
  | "MISSING_METADATA"
  | "INVALID_METADATA"
  | "METADATA_MISMATCH"
  | "TARGET_CONFLICT"
  | "IDENTICAL_DUPLICATE"
  | "ORPHAN_METADATA";

export interface AtomicWriteMetadata {
  schema_version: 1;
  target_name: string;
  kind: AtomicWriteKind;
  size_bytes: number;
  digest: string;
  created_at: string;
}

export interface AtomicRecoveryRecord {
  schema_version: 1;
  at: string;
  action: AtomicRecoveryAction;
  reason: AtomicRecoveryReason;
  target_path: string;
  temporary_path: string;
  metadata_path?: string;
  quarantine_paths?: string[];
}

function relativePath(root: string, path: string): string {
  return relative(root, path).replaceAll("\\", "/");
}

function metadataPath(temporaryPath: string): string {
  return `${temporaryPath}.meta.json`;
}

export function createAtomicWriteMetadata(
  targetName: string,
  content: string | Uint8Array,
  kind: AtomicWriteKind
): AtomicWriteMetadata {
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return {
    schema_version: 1,
    target_name: targetName,
    kind,
    size_bytes: bytes.byteLength,
    digest: sha256(bytes),
    created_at: new Date().toISOString()
  };
}

function isValidMetadata(value: unknown, targetName: string): value is AtomicWriteMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Partial<AtomicWriteMetadata>;
  return metadata.schema_version === 1
    && metadata.target_name === targetName
    && (metadata.kind === "json" || metadata.kind === "text")
    && Number.isInteger(metadata.size_bytes)
    && (metadata.size_bytes ?? -1) >= 0
    && typeof metadata.digest === "string"
    && /^sha256:[a-f0-9]{64}$/.test(metadata.digest)
    && typeof metadata.created_at === "string"
    && Number.isFinite(Date.parse(metadata.created_at));
}

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

async function walkOwnedTemporaryFiles(root: string): Promise<{ temporary: string[]; metadata: string[] }> {
  const temporary: string[] = [];
  const metadata: string[] = [];
  const dokionRoot = join(root, ".dokion");

  const walk = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      const rel = relativePath(root, path);
      if (entry.isDirectory()) {
        if (rel === ".dokion/recovery" || rel.startsWith(".dokion/recovery/")) continue;
        await walk(path);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".tmp.meta.json")) metadata.push(path);
      else if (entry.name.endsWith(".tmp")) temporary.push(path);
    }
  };

  await walk(dokionRoot);
  for (const suffix of ["", ".meta.json"]) {
    const path = join(root, `HARDENING.md.tmp${suffix}`);
    if (await exists(path)) (suffix ? metadata : temporary).push(path);
  }
  return {
    temporary: temporary.sort((left, right) => relativePath(root, left).localeCompare(relativePath(root, right))),
    metadata: metadata.sort((left, right) => relativePath(root, left).localeCompare(relativePath(root, right)))
  };
}

async function quarantine(
  root: string,
  temporaryPath: string,
  metadataFile: string,
  record: Omit<AtomicRecoveryRecord, "quarantine_paths">
): Promise<AtomicRecoveryRecord> {
  const recoveryId = `${record.at.replaceAll(":", "-")}-${crypto.randomUUID().slice(0, 8)}`;
  const directory = join(root, ATOMIC_RECOVERY_QUARANTINE_PATH, recoveryId);
  await mkdir(directory, { recursive: true });
  const quarantinePaths: string[] = [];

  if (await exists(temporaryPath)) {
    const destination = join(directory, relativePath(root, temporaryPath).replaceAll("/", "__"));
    await rename(temporaryPath, destination);
    quarantinePaths.push(relativePath(root, destination));
  }
  if (await exists(metadataFile)) {
    const destination = join(directory, relativePath(root, metadataFile).replaceAll("/", "__"));
    await rename(metadataFile, destination);
    quarantinePaths.push(relativePath(root, destination));
  }
  return { ...record, quarantine_paths: quarantinePaths };
}

async function appendRecoveryRecords(root: string, records: AtomicRecoveryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const path = join(root, ATOMIC_RECOVERY_LOG_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, records.map((record) => JSON.stringify(record)).join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
}

export async function recoverAtomicWrites(root: string): Promise<AtomicRecoveryRecord[]> {
  const discovered = await walkOwnedTemporaryFiles(root);
  const records: AtomicRecoveryRecord[] = [];
  const processedMetadata = new Set<string>();

  for (const temporaryPath of discovered.temporary) {
    const targetPath = temporaryPath.slice(0, -".tmp".length);
    const metadataFile = metadataPath(temporaryPath);
    const at = new Date().toISOString();
    const base = {
      schema_version: 1 as const,
      at,
      target_path: relativePath(root, targetPath),
      temporary_path: relativePath(root, temporaryPath),
      metadata_path: relativePath(root, metadataFile)
    };
    processedMetadata.add(metadataFile);

    if (!(await exists(metadataFile))) {
      records.push(await quarantine(root, temporaryPath, metadataFile, {
        ...base,
        action: "QUARANTINED",
        reason: "MISSING_METADATA"
      }));
      continue;
    }

    let metadataValue: unknown;
    try {
      metadataValue = JSON.parse(await readFile(metadataFile, "utf8"));
    } catch {
      records.push(await quarantine(root, temporaryPath, metadataFile, {
        ...base,
        action: "QUARANTINED",
        reason: "INVALID_METADATA"
      }));
      continue;
    }
    if (!isValidMetadata(metadataValue, basename(targetPath))) {
      records.push(await quarantine(root, temporaryPath, metadataFile, {
        ...base,
        action: "QUARANTINED",
        reason: "INVALID_METADATA"
      }));
      continue;
    }

    const metadata = metadataValue;
    const temporaryContent = await readFile(temporaryPath);
    if (temporaryContent.byteLength !== metadata.size_bytes || sha256(temporaryContent) !== metadata.digest) {
      records.push(await quarantine(root, temporaryPath, metadataFile, {
        ...base,
        action: "QUARANTINED",
        reason: "METADATA_MISMATCH"
      }));
      continue;
    }
    if (metadata.kind === "json") {
      try {
        JSON.parse(temporaryContent.toString("utf8"));
      } catch {
        records.push(await quarantine(root, temporaryPath, metadataFile, {
          ...base,
          action: "QUARANTINED",
          reason: "INVALID_JSON"
        }));
        continue;
      }
    }

    if (await exists(targetPath)) {
      const targetContent = await readFile(targetPath);
      if (sha256(targetContent) === metadata.digest) {
        await rm(temporaryPath, { force: true });
        await rm(metadataFile, { force: true });
        records.push({
          ...base,
          action: "DISCARDED_DUPLICATE",
          reason: "IDENTICAL_DUPLICATE"
        });
      } else {
        records.push(await quarantine(root, temporaryPath, metadataFile, {
          ...base,
          action: "QUARANTINED",
          reason: "TARGET_CONFLICT"
        }));
      }
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await rename(temporaryPath, targetPath);
    await rm(metadataFile, { force: true });
    records.push({
      ...base,
      action: "RECOVERED",
      reason: "VERIFIED_TEMPORARY"
    });
  }

  for (const metadataFile of discovered.metadata) {
    if (processedMetadata.has(metadataFile) || !(await exists(metadataFile))) continue;
    const temporaryPath = metadataFile.slice(0, -".meta.json".length);
    const targetPath = temporaryPath.endsWith(".tmp") ? temporaryPath.slice(0, -4) : temporaryPath;
    const at = new Date().toISOString();
    records.push(await quarantine(root, temporaryPath, metadataFile, {
      schema_version: 1,
      at,
      action: "QUARANTINED",
      reason: "ORPHAN_METADATA",
      target_path: relativePath(root, targetPath),
      temporary_path: relativePath(root, temporaryPath),
      metadata_path: relativePath(root, metadataFile)
    }));
  }

  await appendRecoveryRecords(root, records);
  return records;
}
