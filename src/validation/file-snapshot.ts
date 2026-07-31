import { createHash } from "node:crypto";
import { createReadStream, type Stats } from "node:fs";
import { lstat, readlink } from "node:fs/promises";
import { resolve } from "node:path";

import { DokionError } from "../core/errors.ts";

export type FileSnapshotRollbackReason =
  | "COPY_LIMIT_EXCEEDED"
  | "HARD_LINK_UNSUPPORTED"
  | "UNSUPPORTED_ENTRY";

export interface FileSnapshotOptions {
  maxCopyBytes: number;
  maxInspectionBytes?: number;
  requireExactRollback?: boolean;
}

export interface ExactRollbackStatus {
  supported: boolean;
  reason: FileSnapshotRollbackReason | null;
}

export interface FileSnapshotCopy {
  encoding: "base64";
  data: string;
  bytes: number;
  digest: string;
}

interface SnapshotMetadata {
  path: string;
  mode: number;
  size: number;
  digest: string;
  capturedAt: string;
  exactRollback: ExactRollbackStatus;
}

export interface MissingFileSnapshot {
  kind: "missing";
  path: string;
  digest: string;
  capturedAt: string;
  exactRollback: ExactRollbackStatus;
}

export interface SymlinkFileSnapshot extends SnapshotMetadata {
  kind: "symlink";
  target: string;
}

export interface RegularFileSnapshot extends SnapshotMetadata {
  kind: "file";
  classification: "text" | "binary";
  copy: FileSnapshotCopy | null;
  linkCount: number;
}

export interface UnsupportedFileSnapshot extends SnapshotMetadata {
  kind: "unsupported";
  entryType: "directory" | "special";
}

export type FileSnapshot =
  | MissingFileSnapshot
  | SymlinkFileSnapshot
  | RegularFileSnapshot
  | UnsupportedFileSnapshot;

const HARD_MAX_COPY_BYTES = 64 * 1024 * 1024;
const HARD_MAX_INSPECTION_BYTES = 64 * 1024;
const DEFAULT_INSPECTION_BYTES = 64 * 1024;

function digestValue(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  hash.update(value);
  return `sha256:${hash.digest("hex")}`;
}

function fail(reason: string, message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("WORKTREE_SNAPSHOT_FAILED", message, { reason, ...details });
}

function requireBound(field: string, value: number, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail("INVALID_OPTIONS", `${field} must be an integer between ${minimum} and ${maximum}`, {
      field,
      value
    });
  }
  return value;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function statPath(path: string): Promise<Stats> {
  return lstat(path);
}

function exactStatus(reason: FileSnapshotRollbackReason | null): ExactRollbackStatus {
  return reason === null
    ? { supported: true, reason: null }
    : { supported: false, reason };
}

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function sameMetadata(left: Stats, right: Stats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mode === right.mode
    && left.mtimeMs === right.mtimeMs;
}

function requireExact<T extends FileSnapshot>(snapshot: T, required: boolean): T {
  if (required && !snapshot.exactRollback.supported) {
    fail("EXACT_ROLLBACK_UNAVAILABLE", "Exact rollback cannot be proven for this entry", {
      path: snapshot.path,
      kind: snapshot.kind,
      size: "size" in snapshot ? snapshot.size : 0,
      digest: snapshot.digest,
      cause: snapshot.exactRollback.reason
    });
  }
  return snapshot;
}

async function captureSymlink(
  path: string,
  before: Stats,
  required: boolean
): Promise<SymlinkFileSnapshot> {
  const target = await readlink(path);
  const after = await statPath(path);
  if (!sameMetadata(before, after)) {
    fail("FILE_CHANGED_DURING_CAPTURE", "Symlink changed during snapshot capture", { path });
  }
  const snapshot: SymlinkFileSnapshot = {
    kind: "symlink",
    path,
    target,
    mode: before.mode & 0o777,
    size: Buffer.byteLength(target),
    digest: digestValue(`symlink:${target}:${before.mode & 0o777}`),
    capturedAt: new Date().toISOString(),
    exactRollback: exactStatus(null)
  };
  return requireExact(snapshot, required);
}

function captureUnsupported(
  path: string,
  before: Stats,
  required: boolean
): UnsupportedFileSnapshot {
  const entryType = before.isDirectory() ? "directory" : "special";
  const snapshot: UnsupportedFileSnapshot = {
    kind: "unsupported",
    entryType,
    path,
    mode: before.mode & 0o777,
    size: before.size,
    digest: digestValue(JSON.stringify({
      entryType,
      mode: before.mode & 0o777,
      size: before.size
    })),
    capturedAt: new Date().toISOString(),
    exactRollback: exactStatus("UNSUPPORTED_ENTRY")
  };
  return requireExact(snapshot, required);
}

interface StreamCapture {
  digest: string;
  bytesObserved: number;
  classification: "text" | "binary";
  inspection: Uint8Array;
  copy: Uint8Array | null;
}

async function streamFile(
  path: string,
  inspectionLimit: number,
  copyEnabled: boolean
): Promise<StreamCapture> {
  const hash = createHash("sha256");
  const inspectionChunks: Uint8Array[] = [];
  const copyChunks: Uint8Array[] = [];
  let inspectionBytes = 0;
  let copyBytes = 0;
  let bytesObserved = 0;
  let textual = true;
  const decoder = new TextDecoder("utf-8", { fatal: true });

  try {
    for await (const rawChunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
      const chunk = new Uint8Array(rawChunk as Buffer);
      hash.update(chunk);
      bytesObserved += chunk.byteLength;

      if (textual) {
        if (chunk.some((byte) => byte === 0 || byte < 9 || (byte > 13 && byte < 32))) {
          textual = false;
        } else {
          try {
            decoder.decode(chunk, { stream: true });
          } catch {
            textual = false;
          }
        }
      }

      if (inspectionBytes < inspectionLimit) {
        const length = Math.min(chunk.byteLength, inspectionLimit - inspectionBytes);
        inspectionChunks.push(chunk.slice(0, length));
        inspectionBytes += length;
      }
      if (copyEnabled) {
        copyChunks.push(chunk.slice());
        copyBytes += chunk.byteLength;
      }
    }
  } catch (error) {
    fail("READ_FAILED", "File bytes could not be read for snapshot", {
      path,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (textual) {
    try {
      decoder.decode();
    } catch {
      textual = false;
    }
  }

  return {
    digest: `sha256:${hash.digest("hex")}`,
    bytesObserved,
    classification: textual ? "text" : "binary",
    inspection: concatChunks(inspectionChunks, inspectionBytes),
    copy: copyEnabled ? concatChunks(copyChunks, copyBytes) : null
  };
}

async function captureRegularFile(
  path: string,
  before: Stats,
  maxCopyBytes: number,
  inspectionLimit: number,
  required: boolean
): Promise<RegularFileSnapshot> {
  const copyEnabled = before.size <= maxCopyBytes;
  const captured = await streamFile(path, inspectionLimit, copyEnabled);
  let after: Stats;
  try {
    after = await statPath(path);
  } catch {
    fail("FILE_CHANGED_DURING_CAPTURE", "File disappeared during snapshot capture", { path });
  }
  if (!sameMetadata(before, after) || captured.bytesObserved !== before.size) {
    fail("FILE_CHANGED_DURING_CAPTURE", "File changed during snapshot capture", {
      path,
      expectedBytes: before.size,
      observedBytes: captured.bytesObserved
    });
  }

  const rollbackReason: FileSnapshotRollbackReason | null = before.nlink > 1
    ? "HARD_LINK_UNSUPPORTED"
    : copyEnabled ? null : "COPY_LIMIT_EXCEEDED";
  const copy = captured.copy === null ? null : {
    encoding: "base64" as const,
    data: Buffer.from(captured.copy).toString("base64"),
    bytes: captured.copy.byteLength,
    digest: captured.digest
  };

  const snapshot: RegularFileSnapshot = {
    kind: "file",
    path,
    classification: captured.classification,
    mode: before.mode & 0o777,
    size: before.size,
    linkCount: before.nlink,
    digest: captured.digest,
    copy,
    capturedAt: new Date().toISOString(),
    exactRollback: exactStatus(rollbackReason)
  };
  return requireExact(snapshot, required);
}

export async function captureFileSnapshot(
  pathValue: string,
  options: FileSnapshotOptions
): Promise<FileSnapshot> {
  if (typeof pathValue !== "string" || pathValue.length === 0 || pathValue.includes("\u0000")) {
    fail("INVALID_OPTIONS", "Snapshot path is invalid", { path: pathValue });
  }

  const maxCopyBytes = requireBound("maxCopyBytes", options.maxCopyBytes, 0, HARD_MAX_COPY_BYTES);
  const maxInspectionBytes = requireBound(
    "maxInspectionBytes",
    options.maxInspectionBytes ?? DEFAULT_INSPECTION_BYTES,
    1,
    HARD_MAX_INSPECTION_BYTES
  );
  const required = options.requireExactRollback ?? false;
  const path = resolve(pathValue);

  let before: Stats;
  try {
    before = await statPath(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    return {
      kind: "missing",
      path,
      digest: digestValue("missing"),
      capturedAt: new Date().toISOString(),
      exactRollback: exactStatus(null)
    };
  }

  if (before.isSymbolicLink()) return captureSymlink(path, before, required);
  if (before.isFile()) {
    return captureRegularFile(path, before, maxCopyBytes, maxInspectionBytes, required);
  }
  return captureUnsupported(path, before, required);
}
