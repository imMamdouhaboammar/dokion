import { readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

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

function fail(message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("INVALID_STATE", message, details);
}

function captureFlagValues(command: string, names: readonly string[]): string[] {
  const values: string[] = [];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?:=|\\s+)(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, "g");
    for (const match of command.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3];
      if (value) values.push(value);
    }
  }
  return [...new Set(values)];
}

function hasFlag(command: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`).test(command);
}

function requireSingleFormat(
  capabilityId: string,
  values: string[],
  allowed: readonly NativeScannerFormat[]
): NativeScannerFormat {
  const normalized = [...new Set(values.map((value) => value.trim().toLowerCase()))];
  if (normalized.length !== 1 || !allowed.includes(normalized[0] as NativeScannerFormat)) {
    fail("Native scanner command must declare one supported JSON output format", {
      capabilityId,
      declaredFormats: normalized,
      allowedFormats: allowed,
    });
  }
  return normalized[0] as NativeScannerFormat;
}

function declaredOutputFormat(capabilityId: string, command: string): NativeScannerFormat {
  switch (capabilityId.trim().toLowerCase()) {
    case "osv-scanner":
      return requireSingleFormat(capabilityId, captureFlagValues(command, ["--format"]), ["json"]);
    case "gitleaks":
      return requireSingleFormat(capabilityId, captureFlagValues(command, ["--report-format"]), ["json"]);
    case "semgrep":
      if (hasFlag(command, "--json") || captureFlagValues(command, ["--json-output"]).length === 1) {
        return "json";
      }
      fail("Native scanner command must declare one supported JSON output format", {
        capabilityId,
        allowedFormats: ["json"],
      });
    case "trivy":
      return requireSingleFormat(capabilityId, captureFlagValues(command, ["--format"]), ["json", "cyclonedx"]);
    default:
      throw new DokionError("UNSUPPORTED_EXECUTION", `No native scanner adapter is registered for ${capabilityId}`);
  }
}

function declaredOutputPath(capabilityId: string, command: string): string | undefined {
  const normalized = capabilityId.trim().toLowerCase();
  const flags = normalized === "gitleaks"
    ? ["--report-path"]
    : normalized === "semgrep"
      ? ["--json-output", "--output", "--output-file", "-o"]
      : ["--output", "--output-file", "-o"];
  const values = captureFlagValues(command, flags);
  if (values.length > 1) {
    fail("Native scanner command declares multiple output paths", { capabilityId, values });
  }
  return values[0];
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

  const declaredFormat = declaredOutputFormat(capabilityId, command);
  const outputPath = declaredOutputPath(capabilityId, command);
  if (!outputPath) return { adapter, declaredFormat };
  if (reservedArtifacts.includes(outputPath)) {
    fail("Native scanner output path collides with an internal Dokion artifact", {
      capabilityId,
      outputPath,
    });
  }

  const decision = await evaluateRepositoryPath(root, outputPath, [".dokion/evidence/"]);
  if (!decision.allowed) {
    fail("Native scanner output path failed repository path policy", {
      capabilityId,
      outputPath,
      reason: decision.reason,
      detail: decision.detail,
    });
  }

  return {
    adapter,
    declaredFormat,
    declaredOutputPath: decision.canonicalPath ?? outputPath,
  };
}

function scrubSensitiveFields(value: unknown, capabilityId: string): unknown {
  const normalized = capabilityId.trim().toLowerCase();
  if (normalized !== "gitleaks" && normalized !== "trivy") return value;
  if (Array.isArray(value)) return value.map((item) => scrubSensitiveFields(item, capabilityId));
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const sensitive = key.toLowerCase();
    if (sensitive === "secret" || sensitive === "match" || sensitive === "line" || sensitive === "code") {
      continue;
    }
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

async function readNativeArtifact(sourcePath: string, capabilityId: string): Promise<Uint8Array> {
  try {
    const metadata = await stat(sourcePath);
    if (!metadata.isFile()) {
      fail("Native scanner output is not a regular file", { capabilityId, sourcePath });
    }
    if (metadata.size === 0) {
      fail("Native scanner emitted an empty JSON artifact", { capabilityId });
    }
    if (metadata.size > MAX_NATIVE_SCANNER_BYTES) {
      fail("Native scanner output exceeds the maximum evidence size", {
        capabilityId,
        bytes: metadata.size,
        maximumBytes: MAX_NATIVE_SCANNER_BYTES,
      });
    }
    return await readFile(sourcePath);
  } catch (error) {
    if (error instanceof DokionError) throw error;
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

export async function materializeNativeScannerOutput(
  input: MaterializeNativeScannerInput
): Promise<NativeScannerOutput> {
  const preflight = await validateNativeScannerCommand(
    input.root,
    input.capabilityId,
    input.command,
    [input.nativeArtifact, input.convertedArtifact]
  );
  const sourcePath = preflight.declaredOutputPath
    ? resolve(input.root, preflight.declaredOutputPath)
    : resolve(input.root, input.result.stdoutArtifact.artifactPath);
  const nativePath = resolve(input.root, input.nativeArtifact);
  const convertedPath = resolve(input.root, input.convertedArtifact);
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

    const bytes = await readNativeArtifact(sourcePath, input.capabilityId);
    const payload = parseJson(bytes, input.capabilityId);
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
    return {
      adapter: preflight.adapter,
      envelope,
      nativeArtifact: input.nativeArtifact,
      convertedArtifact: input.convertedArtifact,
    };
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
