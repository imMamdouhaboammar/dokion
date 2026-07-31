import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";

export const MAX_OUTPUT_ARTIFACT_BYTES = 64 * 1024 * 1024;
export const MAX_OUTPUT_SUMMARY_BYTES = 64 * 1024;
export const OUTPUT_TRUNCATION_MARKER = "DOKION_OUTPUT_TRUNCATED" as const;

export interface OutputSpoolOptions {
  root: string;
  artifactPath: string;
  maxArtifactBytes: number;
  maxSummaryBytes: number;
  mediaType?: string;
}

export interface OutputSpoolResult {
  artifactPath: string;
  mediaType: string;
  bytesObserved: number;
  bytesStored: number;
  truncated: boolean;
  truncationMarker?: typeof OUTPUT_TRUNCATION_MARKER;
  artifactDigest: string;
  observedDigest: string;
  summary: string;
  summaryEncoding: "utf8" | "base64";
}

function invalid(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Output spool options are invalid: ${reason}`, { field });
}

function requireBound(field: string, value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    invalid(field, `${field} must be an integer between 0 and ${maximum}`);
  }
  return value;
}

function resolveArtifactPath(rootValue: string, artifactPath: string): {
  root: string;
  relativePath: string;
  absolutePath: string;
} {
  const root = resolve(rootValue);
  if (!artifactPath || isAbsolute(artifactPath) || artifactPath.includes("\\")) {
    invalid("artifactPath", "artifact path must be a repository-relative POSIX path");
  }
  const segments = artifactPath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    invalid("artifactPath", "artifact path contains an unsafe segment");
  }
  if (!artifactPath.startsWith(".dokion/evidence/")) {
    invalid("artifactPath", "artifact path must be inside .dokion/evidence");
  }
  const absolutePath = resolve(root, artifactPath);
  const fromRoot = relative(root, absolutePath);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    invalid("artifactPath", "artifact path escapes the repository root");
  }
  return { root, relativePath: artifactPath, absolutePath };
}

function requireMediaType(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;\s*charset=[A-Za-z0-9._-]+)?$/.test(value)) {
    invalid("mediaType", "media type is invalid");
  }
  return value;
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

function isProbablyText(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if (byte === 0 || (byte < 9) || (byte > 13 && byte < 32)) return false;
  }
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

function renderSummary(bytes: Uint8Array, mediaTypeOverride: string | undefined): {
  mediaType: string;
  summary: string;
  summaryEncoding: "utf8" | "base64";
} {
  const textual = mediaTypeOverride !== undefined
    ? mediaTypeOverride.startsWith("text/") || /(?:json|xml|javascript|yaml|toml)/i.test(mediaTypeOverride)
    : isProbablyText(bytes);
  const mediaType = mediaTypeOverride ?? (textual ? "text/plain; charset=utf-8" : "application/octet-stream");
  if (textual) {
    return {
      mediaType,
      summary: new TextDecoder("utf-8").decode(bytes),
      summaryEncoding: "utf8"
    };
  }
  return {
    mediaType,
    summary: Buffer.from(bytes).toString("base64"),
    summaryEncoding: "base64"
  };
}

function digest(hash: ReturnType<typeof createHash>): string {
  return `sha256:${hash.digest("hex")}`;
}

export async function spoolOutput(
  stream: ReadableStream<Uint8Array> | null,
  options: OutputSpoolOptions
): Promise<OutputSpoolResult> {
  const artifact = resolveArtifactPath(options.root, options.artifactPath);
  const maxArtifactBytes = requireBound("maxArtifactBytes", options.maxArtifactBytes, MAX_OUTPUT_ARTIFACT_BYTES);
  const maxSummaryBytes = requireBound("maxSummaryBytes", options.maxSummaryBytes, MAX_OUTPUT_SUMMARY_BYTES);
  const mediaTypeOverride = requireMediaType(options.mediaType);

  if (await Bun.file(artifact.absolutePath).exists()) {
    throw new DokionError("INVALID_STATE", "Output evidence artifact already exists", {
      artifactPath: artifact.relativePath
    });
  }

  await mkdir(dirname(artifact.absolutePath), { recursive: true });
  const tempPath = `${artifact.absolutePath}.${randomUUID()}.tmp`;
  const file = await open(tempPath, "wx", 0o600);
  const artifactHash = createHash("sha256");
  const observedHash = createHash("sha256");
  const summaryChunks: Uint8Array[] = [];
  let summaryBytes = 0;
  let bytesObserved = 0;
  let bytesStored = 0;

  async function writeAll(bytes: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const { bytesWritten } = await file.write(bytes, offset, bytes.byteLength - offset, null);
      if (bytesWritten <= 0) {
        throw new DokionError("INVALID_STATE", "Output evidence write made no progress", {
          artifactPath: artifact.relativePath
        });
      }
      offset += bytesWritten;
    }
  }

  const reader = stream?.getReader();
  try {
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      observedHash.update(value);
      bytesObserved += value.byteLength;

      if (summaryBytes < maxSummaryBytes) {
        const summaryLength = Math.min(value.byteLength, maxSummaryBytes - summaryBytes);
        if (summaryLength > 0) {
          summaryChunks.push(value.slice(0, summaryLength));
          summaryBytes += summaryLength;
        }
      }

      if (bytesStored < maxArtifactBytes) {
        const storedLength = Math.min(value.byteLength, maxArtifactBytes - bytesStored);
        if (storedLength > 0) {
          const stored = value.subarray(0, storedLength);
          artifactHash.update(stored);
          await writeAll(stored);
          bytesStored += storedLength;
        }
      }
    }

    await file.sync();
    await file.close();
    await link(tempPath, artifact.absolutePath);

    const summaryBytesValue = concatChunks(summaryChunks, summaryBytes);
    const rendered = renderSummary(summaryBytesValue, mediaTypeOverride);
    const truncated = bytesObserved > bytesStored;

    return {
      artifactPath: artifact.relativePath,
      mediaType: rendered.mediaType,
      bytesObserved,
      bytesStored,
      truncated,
      ...(truncated ? { truncationMarker: OUTPUT_TRUNCATION_MARKER } : {}),
      artifactDigest: digest(artifactHash),
      observedDigest: digest(observedHash),
      summary: rendered.summary,
      summaryEncoding: rendered.summaryEncoding
    };
  } finally {
    reader?.releaseLock();
    await file.close().catch(() => undefined);
    await rm(tempPath, { force: true });
  }
}
