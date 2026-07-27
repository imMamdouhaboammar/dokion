import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

import { DokionError } from "../core/errors.ts";

export const RUN_LOCK_PATH = ".dokion/run.lock.json";
export const RUN_LOCK_RECOVERY_LOG_PATH = ".dokion/recovery/run-locks.ndjson";
const DEFAULT_ARCHIVE_DIRECTORY = ".dokion/recovery/run-locks";
const RUN_LOCK_OPERATIONS = new Set<RunLockOperation>(["run", "resume", "step", "reset", "verify", "autopilot"]);

export type RunLockOperation = "run" | "resume" | "step" | "reset" | "verify" | "autopilot";

export interface RunLockRecord {
  schema_version: 1;
  owner_token: string;
  run_id: string;
  operation: RunLockOperation;
  acquired_at: string;
  process: {
    pid: number;
    host: string;
  };
  recovery: {
    status: "ACTIVE";
    archive_directory: string;
  };
}

export interface RunLockRecoveryRecord {
  schema_version: 1;
  recovered_at: string;
  by: string;
  reason: string;
  previous_owner_token: string;
  previous_run_id: string;
  previous_operation: RunLockOperation;
  previous_process: RunLockRecord["process"];
  archive_path: string;
}

export interface RunLockLease {
  record: RunLockRecord;
  release(): Promise<void>;
}

interface AcquireRunLockInput {
  runId: string;
  operation: RunLockOperation;
}

interface RecoverStaleRunLockInput {
  by: string;
  reason: string;
}

function lockDetails(record: RunLockRecord): Record<string, unknown> {
  return {
    run_id: record.run_id,
    operation: record.operation,
    owner_token: record.owner_token,
    pid: record.process.pid,
    host: record.process.host,
    acquired_at: record.acquired_at
  };
}

function isValidRecord(value: unknown): value is RunLockRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RunLockRecord>;
  return record.schema_version === 1
    && typeof record.owner_token === "string"
    && /^[A-Za-z0-9._-]+$/.test(record.owner_token)
    && typeof record.run_id === "string"
    && record.run_id.length > 0
    && typeof record.operation === "string"
    && RUN_LOCK_OPERATIONS.has(record.operation as RunLockOperation)
    && typeof record.acquired_at === "string"
    && Number.isFinite(Date.parse(record.acquired_at))
    && Number.isInteger(record.process?.pid)
    && (record.process?.pid ?? 0) > 0
    && typeof record.process?.host === "string"
    && record.process.host.length > 0
    && record.recovery?.status === "ACTIVE"
    && record.recovery.archive_directory === DEFAULT_ARCHIVE_DIRECTORY;
}

async function readLock(path: string): Promise<RunLockRecord> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new DokionError("INVALID_RUN_LOCK", "The Dokion run lock is unreadable or invalid", {
      path: RUN_LOCK_PATH,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (!isValidRecord(value)) {
    throw new DokionError("INVALID_RUN_LOCK", "The Dokion run lock does not match the required structure", {
      path: RUN_LOCK_PATH
    });
  }
  return value;
}

function processStatus(record: RunLockRecord): "LIVE" | "STALE" | "UNKNOWN" {
  if (record.process.host !== hostname()) return "UNKNOWN";
  try {
    process.kill(record.process.pid, 0);
    return "LIVE";
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    return code === "ESRCH" ? "STALE" : "UNKNOWN";
  }
}

export async function acquireRunLock(root: string, input: AcquireRunLockInput): Promise<RunLockLease> {
  const path = join(root, RUN_LOCK_PATH);
  const record: RunLockRecord = {
    schema_version: 1,
    owner_token: crypto.randomUUID(),
    run_id: input.runId,
    operation: input.operation,
    acquired_at: new Date().toISOString(),
    process: { pid: process.pid, host: hostname() },
    recovery: { status: "ACTIVE", archive_directory: DEFAULT_ARCHIVE_DIRECTORY }
  };

  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code !== "EEXIST") throw error;
    const existing = await readLock(path);
    const status = processStatus(existing);
    if (status === "STALE") {
      throw new DokionError("RUN_LOCK_STALE", "A stale Dokion run lock requires explicit recovery", lockDetails(existing));
    }
    throw new DokionError("RUN_LOCKED", "Another Dokion operation owns the project run lock", {
      ...lockDetails(existing),
      liveness: status
    });
  }

  let released = false;
  return {
    record,
    async release(): Promise<void> {
      if (released) return;
      const current = await readLock(path);
      if (current.owner_token !== record.owner_token) {
        throw new DokionError("RUN_LOCKED", "Refusing to release a run lock owned by another process", lockDetails(current));
      }
      await rm(path);
      released = true;
    }
  };
}

export async function recoverStaleRunLock(root: string, input: RecoverStaleRunLockInput): Promise<RunLockRecoveryRecord> {
  const by = input.by.trim();
  const reason = input.reason.trim();
  if (!by || !reason) {
    throw new DokionError("INVALID_RUN_LOCK", "Run lock recovery requires a non-empty actor and reason");
  }

  const path = join(root, RUN_LOCK_PATH);
  const existing = await readLock(path);
  const status = processStatus(existing);
  if (status !== "STALE") {
    throw new DokionError("RUN_LOCKED", "The recorded run lock owner is live or cannot be proven stale", {
      ...lockDetails(existing),
      liveness: status
    });
  }

  const recoveredAt = new Date().toISOString();
  const archiveDirectory = join(root, existing.recovery.archive_directory);
  await mkdir(archiveDirectory, { recursive: true });
  const archiveName = `${recoveredAt.replaceAll(":", "-")}-${existing.owner_token}.json`;
  const archivePath = join(archiveDirectory, archiveName);
  await copyFile(path, archivePath);

  const recovery: RunLockRecoveryRecord = {
    schema_version: 1,
    recovered_at: recoveredAt,
    by,
    reason,
    previous_owner_token: existing.owner_token,
    previous_run_id: existing.run_id,
    previous_operation: existing.operation,
    previous_process: existing.process,
    archive_path: join(existing.recovery.archive_directory, archiveName)
  };

  const logPath = join(root, RUN_LOCK_RECOVERY_LOG_PATH);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(recovery)}\n`, { encoding: "utf8", mode: 0o600 });
  await rm(path);
  return recovery;
}
