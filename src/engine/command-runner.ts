import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";

import { DokionError } from "../core/errors.ts";
import {
  normalizeCommandSpec,
  type CommandSpecInput,
  type NormalizedCommandSpec
} from "../execution/command-spec.ts";
import { resolveCommandStrategy } from "../execution/command-strategy.ts";
import {
  buildChildEnvironment,
  type SupportedChildEnvironment
} from "../execution/environment-policy.ts";
import {
  MAX_OUTPUT_ARTIFACT_BYTES,
  MAX_OUTPUT_SUMMARY_BYTES,
  spoolOutput,
  type OutputSpoolResult
} from "../execution/output-spool.ts";
import {
  terminateProcessTree,
  type ProcessTerminationReason,
  type ProcessTerminationResult
} from "../execution/process-controller.ts";

export interface CommandResult {
  command: string;
  commandIdentity: string;
  commandKind: "ARGV" | "SHELL";
  risk: "LOWER" | "HIGHER";
  shellParsing: boolean;
  degradations: string[];
  stdout: string;
  stderr: string;
  stdoutArtifact: OutputSpoolResult;
  stderrArtifact: OutputSpoolResult;
  exitCode: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  environment: {
    inheritedNames: string[];
    runtimeNames: string[];
    missingDeclaredNames: string[];
    deniedNames: string[];
    redactedNames: string[];
  };
}

export interface CommandOptions {
  timeoutSeconds?: number;
  env?: Record<string, string>;
  declaredEnv?: readonly string[];
  parentEnvironment?: Readonly<Record<string, string | undefined>>;
  artifactPrefix?: string;
  maxOutputArtifactBytes?: number;
  maxOutputSummaryBytes?: number;
  platform?: string;
  signal?: AbortSignal;
  terminationGracePeriodMs?: number;
  terminationKillWaitMs?: number;
}

type CommandOutcome =
  | { kind: "EXIT"; exitCode: number }
  | { kind: "TIMEOUT" }
  | { kind: "CANCELLATION" }
  | { kind: "SPAWN_ERROR"; error: unknown }
  | { kind: "IO_ERROR"; stream: "stdout" | "stderr"; error: unknown };

interface ByteReplacement {
  needle: Uint8Array;
  replacement: Uint8Array;
}

const DEFAULT_OUTPUT_ARTIFACT_BYTES = Math.min(4 * 1024 * 1024, MAX_OUTPUT_ARTIFACT_BYTES);
const DEFAULT_OUTPUT_SUMMARY_BYTES = MAX_OUTPUT_SUMMARY_BYTES;
const MAX_TIMEOUT_SECONDS = 3_600;

function invalid(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Command runner options are invalid: ${reason}`, { field });
}

function requireTimeout(value: number | undefined): number {
  const timeout = value ?? 300;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_SECONDS) {
    invalid("timeoutSeconds", `timeoutSeconds must be greater than zero and at most ${MAX_TIMEOUT_SECONDS}`);
  }
  return timeout;
}

function redactString(value: string, environment: SupportedChildEnvironment): string {
  const replacements = environment.redactions
    .flatMap((redaction) => {
      const secret = environment.environment[redaction.name];
      return secret ? [{ secret, token: redaction.token }] : [];
    })
    .sort((left, right) => right.secret.length - left.secret.length);
  return replacements.reduce(
    (redacted, replacement) => redacted.replaceAll(replacement.secret, replacement.token),
    value
  );
}

function displayCommand(command: NormalizedCommandSpec, environment: SupportedChildEnvironment): string {
  if (command.kind === "SHELL") return redactString(command.command, environment);
  const executable = redactString(command.executable, environment);
  const args = command.args.map((argument) => JSON.stringify(redactString(argument, environment)));
  return [executable, ...args].join(" ");
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function prepareEnvironment(options: CommandOptions, platform: string): SupportedChildEnvironment {
  const explicit = options.env ?? {};
  const runtimeValues: Record<string, string> = {};
  const declaredValues: Record<string, string> = {};

  for (const [name, value] of Object.entries(explicit)) {
    if (name.startsWith("DOKION_")) runtimeValues[name] = value;
    else declaredValues[name] = value;
  }

  const parentEnvironment = {
    ...(options.parentEnvironment ?? process.env),
    ...declaredValues
  };
  const declaredNames = sortedUnique([
    ...(options.declaredEnv ?? []),
    ...Object.keys(declaredValues)
  ]);
  const environment = buildChildEnvironment({
    platform,
    parentEnvironment,
    declaredNames,
    runtimeValues
  });

  if (!environment.supported) {
    throw new DokionError("UNSUPPORTED_EXECUTION", environment.reason, {
      platform,
      degradations: environment.degradations
    });
  }

  if (environment.deniedNames.length > 0) {
    throw new DokionError("UNSUPPORTED_EXECUTION", "Declared environment contains denied loader variables", {
      deniedNames: environment.deniedNames
    });
  }
  if (environment.missingDeclaredNames.length > 0) {
    throw new DokionError("DEPENDENCY_UNMET", "Declared environment variables are missing", {
      missingNames: environment.missingDeclaredNames
    });
  }
  return environment;
}

function toWebStream(stream: Readable | null): ReadableStream<Uint8Array> | null {
  if (!stream) return null;
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.byteLength === 0) return right.slice();
  if (right.byteLength === 0) return left.slice();
  const combined = new Uint8Array(left.byteLength + right.byteLength);
  combined.set(left, 0);
  combined.set(right, left.byteLength);
  return combined;
}

function matchesAt(data: Uint8Array, needle: Uint8Array, offset: number): boolean {
  if (offset + needle.byteLength > data.byteLength) return false;
  for (let index = 0; index < needle.byteLength; index += 1) {
    if (data[offset + index] !== needle[index]) return false;
  }
  return true;
}

function concatMany(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function replaceDecidableBytes(
  data: Uint8Array,
  replacements: readonly ByteReplacement[],
  final: boolean
): { output: Uint8Array; remainder: Uint8Array } {
  const maxNeedle = replacements.reduce((maximum, item) => Math.max(maximum, item.needle.byteLength), 1);
  const decisionLimit = final ? data.byteLength : Math.max(0, data.byteLength - maxNeedle + 1);
  const chunks: Uint8Array[] = [];
  let outputBytes = 0;
  let offset = 0;

  while (offset < decisionLimit) {
    const match = replacements.find((item) => matchesAt(data, item.needle, offset));
    if (match) {
      chunks.push(match.replacement);
      outputBytes += match.replacement.byteLength;
      offset += match.needle.byteLength;
    } else {
      const byte = data.slice(offset, offset + 1);
      chunks.push(byte);
      outputBytes += 1;
      offset += 1;
    }
  }

  return {
    output: concatMany(chunks, outputBytes),
    remainder: data.slice(offset)
  };
}

function buildReplacements(environment: SupportedChildEnvironment): ByteReplacement[] {
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const replacements: ByteReplacement[] = [];

  for (const redaction of environment.redactions) {
    const value = environment.environment[redaction.name];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    replacements.push({
      needle: encoder.encode(value),
      replacement: encoder.encode(redaction.token)
    });
  }

  return replacements.sort((left, right) => right.needle.byteLength - left.needle.byteLength);
}

function redactStream(
  stream: ReadableStream<Uint8Array> | null,
  replacements: readonly ByteReplacement[]
): ReadableStream<Uint8Array> | null {
  if (!stream || replacements.length === 0) return stream;
  let pending: Uint8Array<ArrayBufferLike> = new Uint8Array();

  return stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending = concatBytes(pending, chunk);
      const processed = replaceDecidableBytes(pending, replacements, false);
      pending = processed.remainder;
      if (processed.output.byteLength > 0) controller.enqueue(processed.output);
    },
    flush(controller) {
      const processed = replaceDecidableBytes(pending, replacements, true);
      if (processed.output.byteLength > 0) controller.enqueue(processed.output);
      if (processed.remainder.byteLength > 0) controller.enqueue(processed.remainder);
      pending = new Uint8Array();
    }
  }));
}

function exitCodeForSignal(signal: NodeJS.Signals | null): number {
  if (signal === "SIGKILL") return 137;
  if (signal === "SIGTERM") return 143;
  if (signal === "SIGINT") return 130;
  return 1;
}

function failureOnly<T>(
  promise: Promise<T>,
  stream: "stdout" | "stderr"
): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    promise.catch((error) => resolve({ kind: "IO_ERROR", stream, error }));
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultEnvironment(environment: SupportedChildEnvironment): CommandResult["environment"] {
  return {
    inheritedNames: environment.inheritedNames,
    runtimeNames: environment.runtimeNames,
    missingDeclaredNames: environment.missingDeclaredNames,
    deniedNames: environment.deniedNames,
    redactedNames: environment.redactions.map((item) => item.name)
  };
}

function combinedDegradations(
  command: NormalizedCommandSpec,
  strategy: { degradations: readonly string[] },
  environment: SupportedChildEnvironment
): string[] {
  return sortedUnique([
    ...command.degradations,
    ...strategy.degradations,
    ...environment.degradations
  ]);
}

export async function runCommand(
  root: string,
  commandInput: CommandSpecInput,
  options: number | CommandOptions = 300
): Promise<CommandResult> {
  const normalizedOptions: CommandOptions = typeof options === "number"
    ? { timeoutSeconds: options }
    : options;
  const timeoutSeconds = requireTimeout(normalizedOptions.timeoutSeconds);
  const platform = normalizedOptions.platform ?? process.platform;
  const command = normalizeCommandSpec(commandInput);
  const strategy = resolveCommandStrategy(platform, command);

  if (!strategy.supported) {
    throw new DokionError("UNSUPPORTED_EXECUTION", strategy.reason, {
      platform,
      commandIdentity: command.identity,
      degradations: strategy.degradations
    });
  }
  if (normalizedOptions.signal?.aborted) {
    throw new DokionError("COMMAND_FAILED", "Command was cancelled before execution", {
      reason: "CANCELLATION",
      commandIdentity: command.identity
    });
  }

  const environment = prepareEnvironment(normalizedOptions, platform);
  const prefix = (normalizedOptions.artifactPrefix
    ?? `.dokion/evidence/command-output/${randomUUID()}`).replace(/\/+$/, "");
  const maxArtifactBytes = normalizedOptions.maxOutputArtifactBytes ?? DEFAULT_OUTPUT_ARTIFACT_BYTES;
  const maxSummaryBytes = normalizedOptions.maxOutputSummaryBytes ?? DEFAULT_OUTPUT_SUMMARY_BYTES;
  const startedAt = new Date().toISOString();
  const started = performance.now();

  const child = spawn(strategy.spawnArgv[0]!, strategy.spawnArgv.slice(1), {
    cwd: root,
    env: environment.environment,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const exited = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? exitCodeForSignal(signal)));
  });
  const processId = child.pid;
  if (!processId) {
    throw new DokionError("COMMAND_FAILED", "Command process did not expose a pid", {
      commandIdentity: command.identity
    });
  }

  const replacements = buildReplacements(environment);
  const stdoutArtifactPromise = spoolOutput(
    redactStream(toWebStream(child.stdout), replacements),
    {
      root,
      artifactPath: `${prefix}/stdout.bin`,
      maxArtifactBytes,
      maxSummaryBytes
    }
  );
  const stderrArtifactPromise = spoolOutput(
    redactStream(toWebStream(child.stderr), replacements),
    {
      root,
      artifactPath: `${prefix}/stderr.bin`,
      maxArtifactBytes,
      maxSummaryBytes
    }
  );

  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let removeAbortListener: (() => void) | undefined;
  const timeoutOutcome = new Promise<CommandOutcome>((resolve) => {
    timeoutTimer = setTimeout(() => resolve({ kind: "TIMEOUT" }), timeoutSeconds * 1_000);
  });

  const cancellationOutcome = new Promise<CommandOutcome>((resolve) => {
    const signal = normalizedOptions.signal;
    if (!signal) return;
    const onAbort = () => resolve({ kind: "CANCELLATION" });
    signal.addEventListener("abort", onAbort, { once: true });
    removeAbortListener = () => signal.removeEventListener("abort", onAbort);
  });
  const exitOutcome = exited.then<CommandOutcome, CommandOutcome>(
    (exitCode) => ({ kind: "EXIT", exitCode }),
    (error) => ({ kind: "SPAWN_ERROR", error })
  );

  const outcome = await Promise.race<CommandOutcome>([
    exitOutcome,
    timeoutOutcome,
    cancellationOutcome,
    failureOnly(stdoutArtifactPromise, "stdout"),
    failureOnly(stderrArtifactPromise, "stderr")
  ]);

  if (timeoutTimer) clearTimeout(timeoutTimer);
  removeAbortListener?.();

  if (outcome.kind === "EXIT") {
    const [stdoutArtifact, stderrArtifact] = await Promise.all([
      stdoutArtifactPromise,
      stderrArtifactPromise
    ]);
    return {
      command: displayCommand(command, environment),
      commandIdentity: command.identity,
      commandKind: command.kind,
      risk: command.risk,
      shellParsing: strategy.shellParsing,
      degradations: combinedDegradations(command, strategy, environment),
      stdout: stdoutArtifact.summary,
      stderr: stderrArtifact.summary,
      stdoutArtifact,
      stderrArtifact,
      exitCode: outcome.exitCode,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started),
      environment: resultEnvironment(environment)
    };
  }

  const reason: ProcessTerminationReason = outcome.kind === "TIMEOUT"
    ? "TIMEOUT"
    : outcome.kind === "CANCELLATION"
      ? "CANCELLATION"
      : "POLICY_STOP";
  let termination: ProcessTerminationResult | undefined;
  let terminationFailure: unknown;

  try {
    termination = await terminateProcessTree({ pid: processId, exited }, reason, {
      platform,
      ...(normalizedOptions.terminationGracePeriodMs !== undefined
        ? { gracePeriodMs: normalizedOptions.terminationGracePeriodMs }
        : {}),
      ...(normalizedOptions.terminationKillWaitMs !== undefined
        ? { killWaitMs: normalizedOptions.terminationKillWaitMs }
        : {})
    });
  } catch (error) {
    terminationFailure = error;
  }

  const [stdoutArtifactResult, stderrArtifactResult] = await Promise.allSettled([
    stdoutArtifactPromise,
    stderrArtifactPromise
  ]);
  const evidence = {
    ...(stdoutArtifactResult.status === "fulfilled"
      ? { stdoutArtifact: stdoutArtifactResult.value }
      : { stdoutArtifactError: errorMessage(stdoutArtifactResult.reason) }),
    ...(stderrArtifactResult.status === "fulfilled"
      ? { stderrArtifact: stderrArtifactResult.value }
      : { stderrArtifactError: errorMessage(stderrArtifactResult.reason) })
  };

  if (terminationFailure) {
    throw new DokionError("COMMAND_FAILED", "Command process tree termination failed", {
      reason,
      commandIdentity: command.identity,
      terminationError: errorMessage(terminationFailure),
      ...evidence
    });
  }

  const message = outcome.kind === "TIMEOUT"
    ? `Command timed out after ${timeoutSeconds} seconds`
    : outcome.kind === "CANCELLATION"
      ? "Command was cancelled"
      : outcome.kind === "SPAWN_ERROR"
        ? `Command process failed: ${errorMessage(outcome.error)}`
        : `Command ${outcome.stream} evidence stream failed`;

  throw new DokionError("COMMAND_FAILED", message, {
    reason,
    commandIdentity: command.identity,
    termination,
    ...(outcome.kind === "SPAWN_ERROR" ? { processError: errorMessage(outcome.error) } : {}),
    ...(outcome.kind === "IO_ERROR" ? {
      stream: outcome.stream,
      streamError: errorMessage(outcome.error)
    } : {}),
    ...evidence
  });
}
