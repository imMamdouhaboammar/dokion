import { readFile, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";
import { writeJsonAtomic } from "../core/json.ts";
import type { CommandResult } from "../engine/command-runner.ts";
import {
  adaptNativeScannerOutput,
  nativeScannerAcceptsExitCode,
  resolveNativeScannerAdapter,
  type NativeScannerAdapter,
} from "./scanner-output-adapters.ts";
import type { RawFindingEnvelope } from "./types.ts";

export interface NativeScannerOutput {
  adapter: NativeScannerAdapter;
  envelope: RawFindingEnvelope;
  nativeArtifact: string;
  convertedArtifact: string;
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

function declaredOutputPath(capabilityId: string, command: string): string | undefined {
  const normalized = capabilityId.trim().toLowerCase();
  const flags = normalized === "gitleaks"
    ? ["--report-path"]
    : normalized === "semgrep" || normalized === "trivy"
      ? ["--output", "--output-file", "-o"]
      : ["--output", "--output-file", "-o"];
  const values = captureFlagValues(command, flags);
  if (values.length > 1) {
    fail("Native scanner command declares multiple output paths", { capabilityId, values });
  }
  return values[0];
}

function resolveEvidencePath(rootValue: string, pathValue: string): string {
  const root = resolve(rootValue);
  if (!pathValue || isAbsolute(pathValue) || pathValue.includes("\\")) {
    fail("Native scanner output path must be a repository-relative POSIX path", { path: pathValue });
  }
  const segments = pathValue.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail("Native scanner output path contains an unsafe segment", { path: pathValue });
  }
  if (!pathValue.startsWith(".dokion/evidence/")) {
    fail("Native scanner file output must be inside .dokion/evidence", { path: pathValue });
  }
  const absolutePath = resolve(root, pathValue);
  const fromRoot = relative(root, absolutePath);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    fail("Native scanner output path escapes the repository root", { path: pathValue });
  }
  return absolutePath;
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

export async function materializeNativeScannerOutput(
  input: MaterializeNativeScannerInput
): Promise<NativeScannerOutput> {
  const adapter = resolveNativeScannerAdapter(input.capabilityId);
  if (!adapter) {
    throw new DokionError("UNSUPPORTED_EXECUTION", `No native scanner adapter is registered for ${input.capabilityId}`);
  }
  if (!nativeScannerAcceptsExitCode(input.capabilityId, input.result.exitCode)) {
    throw new DokionError("COMMAND_FAILED", `Native scanner command exited ${input.result.exitCode}`, {
      capabilityId: input.capabilityId,
      adapter,
    });
  }

  const declaredPath = declaredOutputPath(input.capabilityId, input.command);
  const sourcePath = declaredPath
    ? resolveEvidencePath(input.root, declaredPath)
    : resolve(input.root, input.result.stdoutArtifact.artifactPath);
  if (!declaredPath && input.result.stdoutArtifact.truncated) {
    fail("Native scanner stdout exceeded the evidence bound and cannot be parsed completely", {
      capabilityId: input.capabilityId,
      bytesObserved: input.result.stdoutArtifact.bytesObserved,
      bytesStored: input.result.stdoutArtifact.bytesStored,
    });
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(sourcePath);
    if (bytes.byteLength === 0) fail("Native scanner emitted an empty JSON artifact", { capabilityId: input.capabilityId });
    const payload = parseJson(bytes, input.capabilityId);
    const sanitizedPayload = scrubSensitiveFields(payload, input.capabilityId);
    const envelope = adaptNativeScannerOutput(input.capabilityId, sanitizedPayload);
    await writeJsonAtomic(resolve(input.root, input.nativeArtifact), sanitizedPayload);
    await writeJsonAtomic(resolve(input.root, input.convertedArtifact), envelope);
    return {
      adapter,
      envelope,
      nativeArtifact: input.nativeArtifact,
      convertedArtifact: input.convertedArtifact,
    };
  } finally {
    await Promise.all([
      rm(sourcePath, { force: true }),
      rm(resolve(input.root, input.result.stdoutArtifact.artifactPath), { force: true }),
      rm(resolve(input.root, input.result.stderrArtifact.artifactPath), { force: true }),
    ]);
  }
}
