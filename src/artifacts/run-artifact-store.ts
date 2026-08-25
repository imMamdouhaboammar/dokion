import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, open, readFile, rm } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";
import { MAX_OUTPUT_ARTIFACT_BYTES } from "../execution/output-spool.ts";
import type {
  PlaybookArtifactKind,
  PlaybookArtifactRetention,
  PlaybookArtifactSensitivity,
  PlaybookOutputDeclaration
} from "../playbook/types.ts";
import { ensureSafeDirectoryPath } from "../security/filesystem-safety.ts";

const MAX_DESCRIPTOR_BYTES = 1024 * 1024;
const SAFE_PATH_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export interface RunArtifactCapabilityIdentity {
  type: string;
  id: string;
  immutable_reference?: string;
}

export interface RunArtifactRepositoryIdentity {
  commit?: string;
  root_digest?: string;
}

export interface RunArtifactDescriptor {
  schema: "dokion.run-artifact.v1";
  artifact_id: `sha256:${string}`;
  name: string;
  kind: PlaybookArtifactKind;
  media_type?: string;
  declared_schema?: string;
  sensitivity: PlaybookArtifactSensitivity;
  retention: PlaybookArtifactRetention;
  digest: `sha256:${string}`;
  size_bytes: number;
  blob_path: string;
  descriptor_path: string;
  created_at: string;
  producer: {
    run_id: string;
    invocation_id: string;
    stage_id: string;
    step_id: string;
    capability: RunArtifactCapabilityIdentity;
  };
  repository?: RunArtifactRepositoryIdentity;
}

export interface MaterializeRunArtifactOptions {
  root: string;
  runId: string;
  invocationId: string;
  stageId: string;
  stepId: string;
  capability: RunArtifactCapabilityIdentity;
  declaration: PlaybookOutputDeclaration;
  bytes: Uint8Array;
  repository?: RunArtifactRepositoryIdentity;
  createdAt?: string;
}

export interface ReadRunArtifactOptions {
  root: string;
  runId: string;
  stepId: string;
  outputName: string;
}

export interface LoadedRunArtifact {
  descriptor: RunArtifactDescriptor;
  bytes: Uint8Array;
}

interface NormalizedOutputDeclaration {
  name: string;
  kind: PlaybookArtifactKind;
  mediaType: string | undefined;
  declaredSchema: string | undefined;
  sensitivity: PlaybookArtifactSensitivity;
  retention: PlaybookArtifactRetention;
}

function sha256Digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("ARTIFACT_INVALID", message, details);
}

function requirePathToken(field: string, value: string): string {
  if (!SAFE_PATH_TOKEN.test(value)) {
    invalid(`Run artifact ${field} is invalid.`, { field });
  }
  return value;
}

function requireMetadataString(field: string, value: string): string {
  if (value.length === 0 || value.length > 512 || value.includes("\0")) {
    invalid(`Run artifact ${field} is invalid.`, { field });
  }
  return value;
}

function requireDigest(value: string, field: string): `sha256:${string}` {
  if (!SHA256_PATTERN.test(value)) {
    invalid(`Run artifact ${field} must be a SHA-256 digest.`, { field });
  }
  return value as `sha256:${string}`;
}

function resolveOwnedPath(rootValue: string, relativePath: string): string {
  const root = resolve(rootValue);
  if (!relativePath || isAbsolute(relativePath) || relativePath.includes("\\")) {
    invalid("Run artifact path must be repository-relative POSIX text.", { relativePath });
  }

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    invalid("Run artifact path contains an unsafe segment.", { relativePath });
  }
  if (!relativePath.startsWith(".dokion/runs/")) {
    invalid("Run artifact path must stay inside .dokion/runs.", { relativePath });
  }

  const absolute = resolve(root, relativePath);
  const fromRoot = relative(root, absolute);
  if (fromRoot === ".." || fromRoot.startsWith("../") || isAbsolute(fromRoot)) {
    invalid("Run artifact path escapes the project root.", { relativePath });
  }
  return absolute;
}

function blobPathForDigest(runId: string, digest: `sha256:${string}`): string {
  const hex = digest.slice("sha256:".length);
  return `.dokion/runs/${runId}/artifacts/sha256/${hex.slice(0, 2)}/${hex.slice(2)}/blob`;
}

function descriptorPath(runId: string, stepId: string, outputName: string): string {
  return `.dokion/runs/${runId}/artifacts/by-step/${stepId}/${outputName}.json`;
}

async function regularFileState(path: string): Promise<"missing" | { size: number }> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new DokionError("ARTIFACT_INVALID", "Run artifact path is not an isolated regular file.", {
        path,
        links: stat.nlink
      });
    }
    return { size: stat.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

async function readBoundedRegularFile(path: string, maximumBytes: number): Promise<Uint8Array> {
  const state = await regularFileState(path);
  if (state === "missing") {
    throw new DokionError("ARTIFACT_NOT_FOUND", "Run artifact file is missing.", { path });
  }
  if (state.size > maximumBytes) {
    throw new DokionError("ARTIFACT_SIZE_MISMATCH", "Run artifact exceeds its configured byte bound.", {
      path,
      size: state.size,
      maximumBytes
    });
  }
  return new Uint8Array(await readFile(path));
}

async function publishImmutableFile(path: string, bytes: Uint8Array): Promise<"created" | "exists"> {
  await ensureSafeDirectoryPath(dirname(path), "ARTIFACT_INVALID");
  const temporary = `${path}.tmp-${randomUUID()}`;
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  try {
    handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(temporary, 0o400);

    try {
      await link(temporary, path);
      return "created";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return "exists";
      throw error;
    }
  } finally {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

function normalizeDeclaration(declaration: PlaybookOutputDeclaration): NormalizedOutputDeclaration {
  requirePathToken("output name", declaration.name);
  if (declaration.kind === "directory") {
    invalid("Directory outputs require a directory-manifest contract and are not materialized as raw bytes yet.", {
      kind: declaration.kind
    });
  }

  return {
    name: declaration.name,
    kind: declaration.kind,
    mediaType: declaration.media_type === undefined
      ? undefined
      : requireMetadataString("media type", declaration.media_type),
    declaredSchema: declaration.schema === undefined
      ? undefined
      : requireMetadataString("declared schema", declaration.schema),
    sensitivity: declaration.sensitivity ?? "INTERNAL",
    retention: declaration.retention ?? "RUN"
  };
}

function descriptorBytes(descriptor: RunArtifactDescriptor): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(descriptor, null, 2)}\n`);
}

function sameBindingIdentity(left: RunArtifactDescriptor, right: RunArtifactDescriptor): boolean {
  return left.digest === right.digest
    && left.size_bytes === right.size_bytes
    && left.name === right.name
    && left.kind === right.kind
    && left.media_type === right.media_type
    && left.declared_schema === right.declared_schema
    && left.sensitivity === right.sensitivity
    && left.retention === right.retention
    && left.producer.run_id === right.producer.run_id
    && left.producer.invocation_id === right.producer.invocation_id
    && left.producer.stage_id === right.producer.stage_id
    && left.producer.step_id === right.producer.step_id
    && left.producer.capability.type === right.producer.capability.type
    && left.producer.capability.id === right.producer.capability.id
    && left.producer.capability.immutable_reference === right.producer.capability.immutable_reference
    && left.repository?.commit === right.repository?.commit
    && left.repository?.root_digest === right.repository?.root_digest;
}

function parseDescriptor(bytes: Uint8Array, expected: ReadRunArtifactOptions): RunArtifactDescriptor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new DokionError("ARTIFACT_INVALID", "Run artifact descriptor is not valid JSON.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    invalid("Run artifact descriptor must be an object.");
  }

  const descriptor = parsed as RunArtifactDescriptor;
  if (descriptor.schema !== "dokion.run-artifact.v1"
      || !SHA256_PATTERN.test(descriptor.digest)
      || descriptor.artifact_id !== descriptor.digest
      || !Number.isSafeInteger(descriptor.size_bytes)
      || descriptor.size_bytes < 0
      || descriptor.producer?.run_id !== expected.runId
      || descriptor.producer?.step_id !== expected.stepId
      || descriptor.name !== expected.outputName) {
    invalid("Run artifact descriptor failed identity validation.", {
      runId: expected.runId,
      stepId: expected.stepId,
      outputName: expected.outputName
    });
  }

  const expectedDescriptorPath = descriptorPath(expected.runId, expected.stepId, expected.outputName);
  const expectedBlobPath = blobPathForDigest(expected.runId, descriptor.digest);
  if (descriptor.descriptor_path !== expectedDescriptorPath || descriptor.blob_path !== expectedBlobPath) {
    invalid("Run artifact descriptor contains a noncanonical path.", {
      descriptorPath: descriptor.descriptor_path,
      blobPath: descriptor.blob_path
    });
  }
  return descriptor;
}

async function readDescriptor(options: ReadRunArtifactOptions): Promise<RunArtifactDescriptor> {
  const runId = requirePathToken("run id", options.runId);
  const stepId = requirePathToken("step id", options.stepId);
  const outputName = requirePathToken("output name", options.outputName);
  const path = resolveOwnedPath(options.root, descriptorPath(runId, stepId, outputName));
  const bytes = await readBoundedRegularFile(path, MAX_DESCRIPTOR_BYTES);
  return parseDescriptor(bytes, { ...options, runId, stepId, outputName });
}

export async function materializeRunArtifact(options: MaterializeRunArtifactOptions): Promise<RunArtifactDescriptor> {
  const runId = requirePathToken("run id", options.runId);
  const invocationId = requirePathToken("invocation id", options.invocationId);
  const stageId = requirePathToken("stage id", options.stageId);
  const stepId = requirePathToken("step id", options.stepId);
  const declaration = normalizeDeclaration(options.declaration);

  requireMetadataString("capability type", options.capability.type);
  requireMetadataString("capability id", options.capability.id);
  if (options.capability.immutable_reference !== undefined) {
    requireMetadataString("capability immutable reference", options.capability.immutable_reference);
  }
  if (options.bytes.byteLength > MAX_OUTPUT_ARTIFACT_BYTES) {
    throw new DokionError("ARTIFACT_SIZE_MISMATCH", "Run artifact exceeds the maximum output artifact size.", {
      size: options.bytes.byteLength,
      maximumBytes: MAX_OUTPUT_ARTIFACT_BYTES
    });
  }
  if (options.repository?.root_digest !== undefined) {
    requireDigest(options.repository.root_digest, "repository root digest");
  }
  if (options.repository?.commit !== undefined) {
    requireMetadataString("repository commit", options.repository.commit);
  }

  const digest = sha256Digest(options.bytes);
  const blobPath = blobPathForDigest(runId, digest);
  const bindingPath = descriptorPath(runId, stepId, declaration.name);
  const candidate: RunArtifactDescriptor = {
    schema: "dokion.run-artifact.v1",
    artifact_id: digest,
    name: declaration.name,
    kind: declaration.kind,
    ...(declaration.mediaType === undefined ? {} : { media_type: declaration.mediaType }),
    ...(declaration.declaredSchema === undefined ? {} : { declared_schema: declaration.declaredSchema }),
    sensitivity: declaration.sensitivity,
    retention: declaration.retention,
    digest,
    size_bytes: options.bytes.byteLength,
    blob_path: blobPath,
    descriptor_path: bindingPath,
    created_at: options.createdAt ?? new Date().toISOString(),
    producer: {
      run_id: runId,
      invocation_id: invocationId,
      stage_id: stageId,
      step_id: stepId,
      capability: {
        type: options.capability.type,
        id: options.capability.id,
        ...(options.capability.immutable_reference === undefined
          ? {}
          : { immutable_reference: options.capability.immutable_reference })
      }
    },
    ...(options.repository === undefined ? {} : { repository: { ...options.repository } })
  };

  const bindingAbsolute = resolveOwnedPath(options.root, bindingPath);
  if (await regularFileState(bindingAbsolute) !== "missing") {
    const existing = await readDescriptor({ root: options.root, runId, stepId, outputName: declaration.name });
    if (!sameBindingIdentity(existing, candidate)) {
      throw new DokionError("ARTIFACT_CONFLICT", "Run artifact output is already materialized with different content or provenance.", {
        runId,
        stepId,
        outputName: declaration.name,
        existingDigest: existing.digest,
        candidateDigest: candidate.digest
      });
    }
    await readRunArtifact({ root: options.root, runId, stepId, outputName: declaration.name });
    return existing;
  }

  const blobAbsolute = resolveOwnedPath(options.root, blobPath);
  if (await publishImmutableFile(blobAbsolute, options.bytes) === "exists") {
    const existingBytes = await readBoundedRegularFile(blobAbsolute, MAX_OUTPUT_ARTIFACT_BYTES);
    if (existingBytes.byteLength !== options.bytes.byteLength) {
      throw new DokionError("ARTIFACT_SIZE_MISMATCH", "Content-addressed run artifact blob has an unexpected size.", {
        expectedSize: options.bytes.byteLength,
        observedSize: existingBytes.byteLength
      });
    }
    if (sha256Digest(existingBytes) !== digest) {
      throw new DokionError("ARTIFACT_DIGEST_MISMATCH", "Content-addressed run artifact blob failed digest verification.", {
        digest
      });
    }
  }

  if (await publishImmutableFile(bindingAbsolute, descriptorBytes(candidate)) === "exists") {
    const existing = await readDescriptor({ root: options.root, runId, stepId, outputName: declaration.name });
    if (!sameBindingIdentity(existing, candidate)) {
      throw new DokionError("ARTIFACT_CONFLICT", "Run artifact output was concurrently materialized with different content or provenance.", {
        runId,
        stepId,
        outputName: declaration.name
      });
    }
    return existing;
  }

  return candidate;
}

export async function readRunArtifact(options: ReadRunArtifactOptions): Promise<LoadedRunArtifact> {
  const descriptor = await readDescriptor(options);
  const blobAbsolute = resolveOwnedPath(options.root, descriptor.blob_path);
  const bytes = await readBoundedRegularFile(blobAbsolute, MAX_OUTPUT_ARTIFACT_BYTES);

  if (bytes.byteLength !== descriptor.size_bytes) {
    throw new DokionError("ARTIFACT_SIZE_MISMATCH", "Run artifact blob size does not match its descriptor.", {
      expectedSize: descriptor.size_bytes,
      observedSize: bytes.byteLength
    });
  }

  const observedDigest = sha256Digest(bytes);
  if (observedDigest !== descriptor.digest) {
    throw new DokionError("ARTIFACT_DIGEST_MISMATCH", "Run artifact blob digest does not match its descriptor.", {
      expectedDigest: descriptor.digest,
      observedDigest
    });
  }

  return { descriptor, bytes };
}
