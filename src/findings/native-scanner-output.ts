import { constants } from "node:fs";
import { lstat, open, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { writeJsonAtomic } from "../core/json.ts";
import type { CommandResult } from "../engine/command-runner.ts";
import { evaluateRepositoryPath } from "../security/path-policy.ts";
import {
  adaptNativeScannerOutput,
  nativeScannerAcceptsExitCode,
  resolveNativeScannerAdapter,
  type NativeScannerAdapter,
} from "./scanner-output-adapters.ts";
import type { RawFindingEnvelope } from "./types.ts";

const MAX_NATIVE_SCANNER_BYTES = 64 * 1024 * 1024;
const MAX_NATIVE_STDERR_SUMMARY = 8 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;

type NativeScannerFormat = "json" | "cyclonedx";

export interface NativeScannerOutput {
  adapter: NativeScannerAdapter;
  envelope: RawFindingEnvelope;
  nativeArtifact: string;
  convertedArtifact: string;
}

export interface NativeScannerCommandPreflight {
  adapter: NativeScannerAdapter;
  declaredFormat: NativeScannerFormat;
  declaredOutputPath?: string;
}

interface MaterializeNativeScannerInput {
  root: string;
  capabilityId: string;
  command: string;
  result: CommandResult;
  nativeArtifact: string;
  convertedArtifact: string;
}

interface NativeSourceMetadata {
  artifact: string;
  bytes?: number;
  digest?: string;
}

interface NativeFailureEvidenceInput {
  root: string;
  capabilityId: string;
  adapter: NativeScannerAdapter;
  result: CommandResult;
  failureArtifact: string;
  error: unknown;
  source?: NativeSourceMetadata;
}

function fail(message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("INVALID_STATE", message, details);
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function tokenizeLiteralShell(command: string): string[] {
  const tokens: string[] = [];
  let token = "";
  let tokenStarted = false;
  let quote: "single" | "double" | null = null;

  const finishToken = () => {
    if (!tokenStarted) return;
    tokens.push(token);
    token = "";
    tokenStarted = false;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]!;
    if (quote === "single") {
      if (character === "'") quote = null;
      else token += character;
      tokenStarted = true;
      continue;
    }
    if (quote === "double") {
      if (character === '"') {
        quote = null;
        tokenStarted = true;
        continue;
      }
      if (character === "$" || character === "`") {
        fail("Native scanner command contains shell expansion inside a quoted value", { character });
      }
      if (character === "\\") {
        const next = command[index + 1];
        if (next === undefined) fail("Native scanner command ends with an incomplete escape");
        token += next;
        tokenStarted = true;
        index += 1;
        continue;
      }
      token += character;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(character)) {
      finishToken();
      continue;
    }
    if (character === "'") {
      quote = "single";
      tokenStarted = true;
      continue;
    }
    if (character === '"') {
      quote = "double";
      tokenStarted = true;
      continue;
    }
    if (character === "\\") {
      const next = command[index + 1];
      if (next === undefined) fail("Native scanner command ends with an incomplete escape");
      token += next;
      tokenStarted = true;
      index += 1;
      continue;
    }
    if ("$`;|&<>(){}*?[]~#!\n\r".includes(character)) {
      fail("Native scanner command contains unsupported shell metacharacters", { character });
    }
    token += character;
    tokenStarted = true;
  }

  if (quote) fail("Native scanner command contains an unterminated quoted value", { quote });
  finishToken();
  return tokens;
}

function captureFlagValues(tokens: readonly string[], names: readonly string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    for (const name of names) {
      if (token === name) {
        const value = tokens[index + 1];
        if (value === undefined) fail("Native scanner command is missing a flag value", { name });
        values.push(value);
      } else if (token.startsWith(`${name}=`)) {
        values.push(token.slice(name.length + 1));
      }
    }
  }
  return values;
}

function hasFlag(tokens: readonly string[], name: string): boolean {
  return tokens.includes(name);
}

function requireSingleFormat(
  capabilityId: string,
  values: string[],
  allowed: readonly NativeScannerFormat[]
): NativeScannerFormat {
  const normalized = values.map((value) => value.trim().toLowerCase());
  if (normalized.length !== 1 || !allowed.includes(normalized[0] as NativeScannerFormat)) {
    fail("Native scanner command must declare one supported JSON output format", {
      capabilityId,
      declaredFormats: normalized,
      allowedFormats: allowed,
    });
  }
  return normalized[0] as NativeScannerFormat;
}

function declaredOutputFormat(
  capabilityId: string,
  tokens: readonly string[]
): NativeScannerFormat {
  switch (capabilityId.trim().toLowerCase()) {
    case "osv-scanner":
      return requireSingleFormat(capabilityId, captureFlagValues(tokens, ["--format"]), ["json"]);
    case "gitleaks":
      return requireSingleFormat(capabilityId, captureFlagValues(tokens, ["--report-format"]), ["json"]);
    case "semgrep": {
      const jsonOutput = captureFlagValues(tokens, ["--json-output"]);
      if (jsonOutput.length > 1 || (hasFlag(tokens, "--json") && jsonOutput.length > 0)) {
        fail("Native scanner command declares an ambiguous JSON output format", { capabilityId });
      }
      if (hasFlag(tokens, "--json") || jsonOutput.length === 1) return "json";
      fail("Native scanner command must declare one supported JSON output format", {
        capabilityId,
        allowedFormats: ["json"],
      });
    }
    case "trivy":
      return requireSingleFormat(capabilityId, captureFlagValues(tokens, ["--format"]), ["json", "cyclonedx"]);
    default:
      throw new DokionError("UNSUPPORTED_EXECUTION", `No native scanner adapter is registered for ${capabilityId}`);
  }
}

function assertLiteralOutputPath(capabilityId: string, path: string): string {
  if (!path || /[$`*?\[\]{}]/.test(path)) {
    fail("Native scanner output path must be a literal value without expansion or glob syntax", {
      capabilityId,
      path,
    });
  }
  return path;
}

function declaredOutputPath(
  capabilityId: string,
  tokens: readonly string[]
): string | undefined {
  const normalized = capabilityId.trim().toLowerCase();
  const flags = normalized === "gitleaks"
    ? ["--report-path"]
    : normalized === "semgrep"
      ? ["--json-output", "--output", "--output-file", "-o"]
      : ["--output", "--output-file", "-o"];
  const values = captureFlagValues(tokens, flags);
  if (values.length > 1) {
    fail("Native scanner command declares multiple output paths", { capabilityId, values });
  }
  return values[0] === undefined ? undefined : assertLiteralOutputPath(capabilityId, values[0]);
}

async function canonicalEvidencePath(root: string, path: string): Promise<string> {
  const decision = await evaluateRepositoryPath(root, path, [".dokion/evidence/"]);
  if (!decision.allowed || !decision.canonicalPath) {
    fail("Native scanner output path failed repository path policy", {
      path,
      reason: decision.reason,
      detail: decision.detail,
    });
  }
  return decision.canonicalPath;
}

export async function validateNativeScannerCommand(
  root: string,
  capabilityId: string,
  command: string,
  reservedArtifacts: readonly string[] = []
): Promise<NativeScannerCommandPreflight> {
  const adapter = resolveNativeScannerAdapter(capabilityId);
  if (!adapter) {
    throw new DokionError("UNSUPPORTED_EXECUTION", `No native scanner adapter is registered for ${capabilityId}`);
  }

  const tokens = tokenizeLiteralShell(command);
  const declaredFormat = declaredOutputFormat(capabilityId, tokens);
  const outputPath = declaredOutputPath(capabilityId, tokens);
  if (!outputPath) return { adapter, declaredFormat };

  const canonicalOutput = await canonicalEvidencePath(root, outputPath);
  const canonicalReserved = await Promise.all(
    reservedArtifacts.map((artifact) => canonicalEvidencePath(root, artifact))
  );
  if (canonicalReserved.includes(canonicalOutput)) {
    fail("Native scanner output path collides with an internal Dokion artifact", {
      capabilityId,
      outputPath,
      canonicalOutput,
    });
  }

  return {
    adapter,
    declaredFormat,
    declaredOutputPath: canonicalOutput,
  };
}

function scrubSensitiveFields(value: unknown, capabilityId: string): unknown {
  const normalized = capabilityId.trim().toLowerCase();
  const sensitiveKeys = normalized === "gitleaks" || normalized === "trivy"
    ? new Set(["secret", "match", "line", "code"])
    : normalized === "semgrep"
      ? new Set(["lines", "metavars", "dataflow_trace"])
      : undefined;
  if (!sensitiveKeys) return value;
  if (Array.isArray(value)) return value.map((item) => scrubSensitiveFields(item, capabilityId));
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (sensitiveKeys.has(key.toLowerCase())) continue;
    output[key] = scrubSensitiveFields(item, capabilityId);
  }
  return output;
}

function parseJson(bytes: Uint8Array, capabilityId: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new DokionError("INVALID_STATE", `Native scanner ${capabilityId} did not emit valid UTF-8 JSON`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function concatenate(chunks: readonly Uint8Array[], totalBytes: number): Uint8Array {
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function readNativeArtifact(
  sourcePath: string,
  capabilityId: string
): Promise<{ bytes: Uint8Array; digest: string }> {
  try {
    const before = await lstat(sourcePath);
    if (before.isSymbolicLink()) {
      fail("Native scanner output path is a symbolic link", { capabilityId });
    }
    if (!before.isFile()) {
      fail("Native scanner output is not a regular file", { capabilityId });
    }
    if (before.size > MAX_NATIVE_SCANNER_BYTES) {
      fail("Native scanner output exceeds the maximum evidence size", {
        capabilityId,
        bytes: before.size,
        maximumBytes: MAX_NATIVE_SCANNER_BYTES,
      });
    }

    const handle = await open(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) {
        fail("Native scanner output changed during secure open", { capabilityId });
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let position = 0;
      while (totalBytes <= MAX_NATIVE_SCANNER_BYTES) {
        const capacity = Math.min(
          READ_CHUNK_BYTES,
          MAX_NATIVE_SCANNER_BYTES + 1 - totalBytes
        );
        const buffer = new Uint8Array(capacity);
        const { bytesRead } = await handle.read(buffer, 0, capacity, position);
        if (bytesRead === 0) break;
        chunks.push(buffer.slice(0, bytesRead));
        totalBytes += bytesRead;
        position += bytesRead;
      }
      if (totalBytes > MAX_NATIVE_SCANNER_BYTES) {
        fail("Native scanner output exceeds the maximum evidence size", {
          capabilityId,
          bytes: totalBytes,
          maximumBytes: MAX_NATIVE_SCANNER_BYTES,
        });
      }
      if (totalBytes === 0) {
        fail("Native scanner emitted an empty JSON artifact", { capabilityId });
      }
      const bytes = concatenate(chunks, totalBytes);
      return { bytes, digest: sha256(bytes) };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error instanceof DokionError) throw error;
    if (errorCode(error) === "ELOOP") {
      fail("Native scanner output path is a symbolic link", { capabilityId });
    }
    throw new DokionError("INVALID_STATE", `Native scanner ${capabilityId} did not create a readable JSON artifact`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

function assertDeclaredFormatMatchesPayload(
  capabilityId: string,
  declaredFormat: NativeScannerFormat,
  payload: unknown
): void {
  if (capabilityId.trim().toLowerCase() !== "trivy") return;
  const actualFormat = payload && typeof payload === "object" && !Array.isArray(payload)
    && (payload as Record<string, unknown>).bomFormat === "CycloneDX"
    ? "cyclonedx"
    : "json";
  if (actualFormat !== declaredFormat) {
    fail("Native scanner payload does not match the declared format", {
      capabilityId,
      declaredFormat,
      actualFormat,
    });
  }
}

export function nativeScannerStderrSummary(result: CommandResult): string {
  const summary = result.stderr.trim().slice(0, MAX_NATIVE_STDERR_SUMMARY);
  return summary || "No native scanner stderr summary was emitted.";
}

export async function writeNativeScannerFailureEvidence(
  input: NativeFailureEvidenceInput
): Promise<string> {
  const dokionError = input.error instanceof DokionError ? input.error : undefined;
  await writeJsonAtomic(resolve(input.root, input.failureArtifact), {
    schema_version: 1,
    capability_id: input.capabilityId,
    adapter: input.adapter,
    command: input.result.command,
    exit_code: input.result.exitCode,
    error: {
      code: dokionError?.code ?? "INVALID_STATE",
      message: input.error instanceof Error ? input.error.message : String(input.error),
    },
    ...(input.source ? { source: input.source } : {}),
    stdout: {
      bytes_observed: input.result.stdoutArtifact.bytesObserved,
      bytes_stored: input.result.stdoutArtifact.bytesStored,
      truncated: input.result.stdoutArtifact.truncated,
      digest: input.result.stdoutArtifact.observedDigest,
    },
    stderr: {
      bytes_observed: input.result.stderrArtifact.bytesObserved,
      bytes_stored: input.result.stderrArtifact.bytesStored,
      truncated: input.result.stderrArtifact.truncated,
      digest: input.result.stderrArtifact.observedDigest,
      summary: nativeScannerStderrSummary(input.result),
    },
    captured_at: new Date().toISOString(),
  });
  return input.failureArtifact;
}

export async function materializeNativeScannerOutput(
  input: MaterializeNativeScannerInput
): Promise<NativeScannerOutput> {
  const preflight = await validateNativeScannerCommand(
    input.root,
    input.capabilityId,
    input.command,
    [input.nativeArtifact, input.convertedArtifact]
  );
  const sourceArtifact = preflight.declaredOutputPath
    ?? input.result.stdoutArtifact.artifactPath;
  const sourcePath = resolve(input.root, sourceArtifact);
  const nativePath = resolve(input.root, input.nativeArtifact);
  const convertedPath = resolve(input.root, input.convertedArtifact);
  const failureArtifact = `${dirname(input.nativeArtifact)}/native-failure.json`;
  let sourceMetadata: NativeSourceMetadata = { artifact: sourceArtifact };
  let nativePersisted = false;
  let convertedPersisted = false;

  try {
    if (!nativeScannerAcceptsExitCode(input.capabilityId, input.result.exitCode)) {
      throw new DokionError("COMMAND_FAILED", `Native scanner command exited ${input.result.exitCode}`, {
        capabilityId: input.capabilityId,
        adapter: preflight.adapter,
      });
    }
    if (!preflight.declaredOutputPath && input.result.stdoutArtifact.truncated) {
      fail("Native scanner stdout exceeded the evidence bound and cannot be parsed completely", {
        capabilityId: input.capabilityId,
        bytesObserved: input.result.stdoutArtifact.bytesObserved,
        bytesStored: input.result.stdoutArtifact.bytesStored,
      });
    }

    const native = await readNativeArtifact(sourcePath, input.capabilityId);
    sourceMetadata = {
      artifact: sourceArtifact,
      bytes: native.bytes.byteLength,
      digest: native.digest,
    };
    const payload = parseJson(native.bytes, input.capabilityId);
    assertDeclaredFormatMatchesPayload(input.capabilityId, preflight.declaredFormat, payload);
    const sanitizedPayload = scrubSensitiveFields(payload, input.capabilityId);
    const envelope = adaptNativeScannerOutput(input.capabilityId, sanitizedPayload);
    if (input.result.exitCode === 1 && envelope.findings.length === 0) {
      fail("Native scanner used its findings exit code but the adapter produced no findings", {
        capabilityId: input.capabilityId,
        adapter: preflight.adapter,
      });
    }
    await writeJsonAtomic(nativePath, sanitizedPayload);
    nativePersisted = true;
    await writeJsonAtomic(convertedPath, envelope);
    convertedPersisted = true;
    await rm(resolve(input.root, failureArtifact), { force: true });
    return {
      adapter: preflight.adapter,
      envelope,
      nativeArtifact: input.nativeArtifact,
      convertedArtifact: input.convertedArtifact,
    };
  } catch (error) {
    const persistedFailure = await writeNativeScannerFailureEvidence({
      root: input.root,
      capabilityId: input.capabilityId,
      adapter: preflight.adapter,
      result: input.result,
      failureArtifact,
      error,
      source: sourceMetadata,
    });
    const code = error instanceof DokionError ? error.code : "INVALID_STATE";
    const details = error instanceof DokionError ? error.details : {};
    throw new DokionError(
      code,
      error instanceof Error ? error.message : String(error),
      { ...details, failureArtifact: persistedFailure }
    );
  } finally {
    const cleanup = new Set([
      sourcePath,
      resolve(input.root, input.result.stdoutArtifact.artifactPath),
      resolve(input.root, input.result.stderrArtifact.artifactPath),
    ]);
    if (nativePersisted) cleanup.delete(nativePath);
    if (convertedPersisted) cleanup.delete(convertedPath);
    await Promise.all([...cleanup].map((path) => rm(path, { force: true })));
  }
}
