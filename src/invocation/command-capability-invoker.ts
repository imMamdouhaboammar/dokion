import { constants } from "node:fs";
import { open, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { resolveStepInputs } from "../artifacts/input-resolver.ts";
import {
  materializeRunArtifact,
  type RunArtifactDescriptor
} from "../artifacts/run-artifact-store.ts";
import {
  assertValidInvocationReceipt,
  assertValidInvocationRequest
} from "../contracts/invocation-schema-validator.ts";
import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import { runCommand } from "../engine/command-runner.ts";
import {
  commandSpecAllowed,
  commandSpecDisplay
} from "../execution/command-policy.ts";
import { normalizeCommandSpec } from "../execution/command-spec.ts";
import { MAX_OUTPUT_ARTIFACT_BYTES } from "../execution/output-spool.ts";
import type {
  PlaybookArtifactKind,
  PlaybookOutputDeclaration,
  PlaybookStage,
  PlaybookStep
} from "../playbook/types.ts";
import { loadActivePlaybook } from "../playbook/load-playbook.ts";
import {
  assertSafeRegularFilePath,
  ensureSafeDirectoryPath
} from "../security/filesystem-safety.ts";
import {
  beginSideEffect,
  completeSideEffect,
  type SideEffectCheckpoint
} from "../state/checkpoint.ts";
import { assertInvocationReplaySafe } from "./replay-policy.ts";

interface InvocationArtifactRef {
  digest: string;
  blob_path: string;
  descriptor_path: string;
}

interface InvocationInput {
  name: string;
  kind: PlaybookArtifactKind;
  required: boolean;
  producer: {
    step: string;
    output: string;
  };
  artifact: InvocationArtifactRef;
}

interface InvocationExpectedOutput {
  name: string;
  kind: Exclude<PlaybookArtifactKind, "directory">;
  media_type?: string;
  declared_schema?: string;
  sensitivity?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET";
  retention?: "RUN" | "PROJECT" | "RELEASE";
  path: string;
}

interface InvocationRequest {
  schema: "dokion.invocation-request.v1";
  invocation_id: string;
  run_id: string;
  stage_id: string;
  step_id: string;
  capability: {
    type: string;
    id: string;
    immutable_reference: string;
  };
  command: {
    identity: string;
    kind: "ARGV" | "SHELL";
  };
  inputs: InvocationInput[];
  legacy_inputs: string[];
  missing_optional_inputs: string[];
  expected_outputs: InvocationExpectedOutput[];
  created_at: string;
}

interface InvocationReceiptOutput {
  name: string;
  kind: Exclude<PlaybookArtifactKind, "directory">;
  artifact: InvocationArtifactRef;
}

interface InvocationReceipt {
  schema: "dokion.invocation-receipt.v1";
  invocation_id: string;
  run_id: string;
  stage_id: string;
  step_id: string;
  capability: InvocationRequest["capability"];
  status: "SUCCEEDED" | "FAILED";
  command: {
    identity: string;
    kind: "ARGV" | "SHELL";
    exit_code: number;
    started_at: string;
    ended_at: string;
    duration_ms: number;
    checkpoint_id: string;
    checkpoint_status: "COMPLETED" | "FAILED";
  };
  inputs: InvocationInput[];
  outputs: InvocationReceiptOutput[];
  failure?: {
    code: string;
    message: string;
  };
  created_at: string;
  ended_at: string;
}

export interface CommandCapabilityInvocationResult {
  status: "SUCCEEDED" | "FAILED";
  reason?: string;
  receiptPath: string;
  command: string;
  exitCode: number;
  endedAt: string;
}

function invocationId(runId: string, stageId: string, stepId: string): string {
  const digest = sha256(JSON.stringify({ runId, stageId, stepId }));
  return `invocation-${digest.slice("sha256:".length, "sha256:".length + 32)}`;
}

function invocationRoot(runId: string, id: string): string {
  return `.dokion/runs/${runId}/invocations/${id}`;
}

function requestPath(runId: string, id: string): string {
  return `${invocationRoot(runId, id)}/request.json`;
}

function receiptPath(runId: string, id: string): string {
  return `${invocationRoot(runId, id)}/receipt.json`;
}

function outputDirectory(runId: string, id: string): string {
  return `${invocationRoot(runId, id)}/outputs`;
}

function absolute(root: string, relativePath: string): string {
  return join(root, ...relativePath.split("/"));
}

function isTypedOutput(
  output: string | PlaybookOutputDeclaration
): output is PlaybookOutputDeclaration {
  return typeof output !== "string";
}

function supportedOutputs(step: PlaybookStep): PlaybookOutputDeclaration[] {
  const outputs = step.outputs ?? [];
  if (outputs.some((output) => !isTypedOutput(output))) {
    throw new DokionError(
      "ARTIFACT_INVALID",
      "Generic capability invocation requires typed output declarations."
    );
  }
  const typed = outputs.filter(isTypedOutput);
  const directory = typed.find((output) => output.kind === "directory");
  if (directory) {
    throw new DokionError(
      "ARTIFACT_INVALID",
      "Directory outputs are not supported by the command invocation artifact contract yet.",
      { output: directory.name }
    );
  }
  return typed;
}

function artifactRef(descriptor: RunArtifactDescriptor): InvocationArtifactRef {
  return {
    digest: descriptor.digest,
    blob_path: descriptor.blob_path,
    descriptor_path: descriptor.descriptor_path
  };
}

function stableRequest(request: InvocationRequest): Omit<InvocationRequest, "created_at"> {
  const { created_at: _createdAt, ...stable } = request;
  return stable;
}

function sameStableRequest(left: InvocationRequest, right: InvocationRequest): boolean {
  return JSON.stringify(stableRequest(left)) === JSON.stringify(stableRequest(right));
}

async function persistRequest(
  root: string,
  path: string,
  candidate: InvocationRequest
): Promise<InvocationRequest> {
  assertValidInvocationRequest(candidate);
  const target = absolute(root, path);
  await ensureSafeDirectoryPath(dirname(target), "ARTIFACT_INVALID");

  if (await Bun.file(target).exists()) {
    await assertSafeRegularFilePath(target, "ARTIFACT_INVALID");
    const existing = await readJson<InvocationRequest>(target);
    assertValidInvocationRequest(existing);
    if (!sameStableRequest(existing, candidate)) {
      throw new DokionError(
        "ARTIFACT_CONFLICT",
        "Persisted invocation request does not match the active Playbook invocation.",
        { path }
      );
    }
    return existing;
  }

  await writeJsonAtomic(target, candidate);
  await assertSafeRegularFilePath(target, "ARTIFACT_INVALID");
  return candidate;
}

async function persistReceipt(root: string, path: string, receipt: InvocationReceipt): Promise<void> {
  assertValidInvocationReceipt(receipt);
  const target = absolute(root, path);
  await ensureSafeDirectoryPath(dirname(target), "ARTIFACT_INVALID");
  if (await Bun.file(target).exists()) {
    throw new DokionError("ARTIFACT_CONFLICT", "Invocation receipt is immutable and already exists.", {
      path
    });
  }
  await writeJsonAtomic(target, receipt);
  await assertSafeRegularFilePath(target, "ARTIFACT_INVALID");
}

async function loadReceiptIfPresent(
  root: string,
  path: string,
  request: InvocationRequest
): Promise<InvocationReceipt | undefined> {
  const target = absolute(root, path);
  if (!(await Bun.file(target).exists())) return undefined;
  await assertSafeRegularFilePath(target, "ARTIFACT_INVALID");
  const receipt = await readJson<InvocationReceipt>(target);
  assertValidInvocationReceipt(receipt);
  const identityMatches =
    receipt.invocation_id === request.invocation_id
    && receipt.run_id === request.run_id
    && receipt.stage_id === request.stage_id
    && receipt.step_id === request.step_id
    && receipt.capability.type === request.capability.type
    && receipt.capability.id === request.capability.id
    && receipt.capability.immutable_reference === request.capability.immutable_reference;
  if (!identityMatches) {
    throw new DokionError(
      "ARTIFACT_INVALID",
      "Persisted invocation receipt identity does not match the active invocation.",
      { path }
    );
  }
  return receipt;
}

function resultFromReceipt(
  receipt: InvocationReceipt,
  path: string,
  display: string
): CommandCapabilityInvocationResult {
  return {
    status: receipt.status,
    ...(receipt.failure ? { reason: receipt.failure.message } : {}),
    receiptPath: path,
    command: display,
    exitCode: receipt.command.exit_code,
    endedAt: receipt.ended_at
  };
}

async function readBoundedOutput(path: string): Promise<Uint8Array> {
  await assertSafeRegularFilePath(path, "ARTIFACT_INVALID");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new DokionError(
        "ARTIFACT_INVALID",
        "Invocation output changed before it could be read safely.",
        { path, links: stat.nlink }
      );
    }
    if (stat.size > MAX_OUTPUT_ARTIFACT_BYTES) {
      throw new DokionError(
        "ARTIFACT_SIZE_MISMATCH",
        "Invocation output exceeds the maximum artifact size.",
        { path, size: stat.size, maximumBytes: MAX_OUTPUT_ARTIFACT_BYTES }
      );
    }
    return new Uint8Array(await handle.readFile());
  } finally {
    await handle.close();
  }
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof DokionError) return { code: error.code, message: error.message };
  return {
    code: "INVALID_STATE",
    message: error instanceof Error ? error.message : String(error)
  };
}

function commandCheckpointDigest(result: {
  commandIdentity: string;
  exitCode: number;
  endedAt: string;
  stdoutObservedDigest: string;
  stderrObservedDigest: string;
}): string {
  return sha256(JSON.stringify(result));
}

function checkpointIntentDigest(request: InvocationRequest): string {
  return sha256(JSON.stringify(stableRequest(request)));
}

async function validateStagedOutputs(
  root: string,
  request: InvocationRequest
): Promise<Array<{ declaration: PlaybookOutputDeclaration; bytes: Uint8Array }>> {
  const directoryRelative = outputDirectory(request.run_id, request.invocation_id);
  const directory = absolute(root, directoryRelative);
  await ensureSafeDirectoryPath(directory, "ARTIFACT_INVALID");

  const entries = await readdir(directory, { withFileTypes: true });
  const expectedNames = new Set(
    request.expected_outputs.map((output) => output.path.split("/").at(-1)!)
  );
  for (const entry of entries) {
    if (!expectedNames.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) {
      throw new DokionError(
        "ARTIFACT_INVALID",
        "Invocation produced an undeclared or unsafe output entry.",
        { entry: entry.name }
      );
    }
  }

  const staged: Array<{ declaration: PlaybookOutputDeclaration; bytes: Uint8Array }> = [];
  for (const output of request.expected_outputs) {
    const filename = output.path.split("/").at(-1)!;
    if (!entries.some((entry) => entry.name === filename)) {
      throw new DokionError(
        "ARTIFACT_NOT_FOUND",
        `Declared invocation output ${output.name} was not produced.`,
        { output: output.name }
      );
    }
    staged.push({
      declaration: {
        name: output.name,
        kind: output.kind,
        ...(output.media_type === undefined ? {} : { media_type: output.media_type }),
        ...(output.declared_schema === undefined ? {} : { schema: output.declared_schema }),
        ...(output.sensitivity === undefined ? {} : { sensitivity: output.sensitivity }),
        ...(output.retention === undefined ? {} : { retention: output.retention })
      },
      bytes: await readBoundedOutput(absolute(root, output.path))
    });
  }
  return staged;
}

async function ensureEmptyOutputDirectory(root: string, runId: string, id: string): Promise<void> {
  const path = absolute(root, outputDirectory(runId, id));
  await ensureSafeDirectoryPath(path, "ARTIFACT_INVALID");
  const entries = await readdir(path);
  if (entries.length > 0) {
    throw new DokionError(
      "ARTIFACT_CONFLICT",
      "Invocation output staging directory was not empty before execution.",
      { entries: entries.sort() }
    );
  }
}

function commandReceipt(
  request: InvocationRequest,
  checkpoint: SideEffectCheckpoint,
  result: {
    commandIdentity: string;
    commandKind: "ARGV" | "SHELL";
    exitCode: number;
    startedAt: string;
    endedAt: string;
    durationMs: number;
  }
): InvocationReceipt["command"] {
  if (checkpoint.status !== "COMPLETED" && checkpoint.status !== "FAILED") {
    throw new DokionError("INVALID_STATE", "Invocation checkpoint did not reach a terminal status.", {
      checkpointId: checkpoint.id,
      status: checkpoint.status
    });
  }
  return {
    identity: result.commandIdentity,
    kind: result.commandKind,
    exit_code: result.exitCode,
    started_at: result.startedAt,
    ended_at: result.endedAt,
    duration_ms: result.durationMs,
    checkpoint_id: checkpoint.id,
    checkpoint_status: checkpoint.status
  };
}

async function buildRequest(input: {
  root: string;
  runId: string;
  stage: PlaybookStage;
  step: PlaybookStep;
}): Promise<InvocationRequest> {
  const entrypoint = input.step.capability.entrypoint;
  if (!entrypoint || entrypoint.kind !== "command") {
    throw new DokionError(
      "UNSUPPORTED_EXECUTION",
      "Generic command invocation requires an explicit capability.entrypoint."
    );
  }

  const loaded = await loadActivePlaybook(input.root);
  const resolved = await resolveStepInputs({
    root: input.root,
    runId: input.runId,
    playbook: loaded.data,
    step: input.step
  });
  if (!commandSpecAllowed(input.step.permissions?.shell, entrypoint.command)) {
    throw new DokionError(
      "UNSUPPORTED_EXECUTION",
      "Capability entrypoint is outside permissions.shell and cannot execute.",
      { stepId: input.step.id }
    );
  }

  const normalized = normalizeCommandSpec(entrypoint.command);
  const id = invocationId(input.runId, input.stage.id, input.step.id);
  const outputs = supportedOutputs(input.step);
  const request: InvocationRequest = {
    schema: "dokion.invocation-request.v1",
    invocation_id: id,
    run_id: input.runId,
    stage_id: input.stage.id,
    step_id: input.step.id,
    capability: {
      type: input.step.capability.type,
      id: input.step.capability.id,
      immutable_reference: input.step.capability.immutable_reference
    },
    command: {
      identity: normalized.identity,
      kind: normalized.kind
    },
    inputs: resolved.inputs.map((resolvedInput) => ({
      name: resolvedInput.name,
      kind: resolvedInput.kind,
      required: resolvedInput.required,
      producer: { ...resolvedInput.producer },
      artifact: artifactRef(resolvedInput.descriptor)
    })),
    legacy_inputs: [...resolved.legacy_inputs],
    missing_optional_inputs: [...resolved.missing_optional],
    expected_outputs: outputs.map((output, index) => ({
      name: output.name,
      kind: output.kind as Exclude<PlaybookArtifactKind, "directory">,
      ...(output.media_type === undefined ? {} : { media_type: output.media_type }),
      ...(output.schema === undefined ? {} : { declared_schema: output.schema }),
      ...(output.sensitivity === undefined ? {} : { sensitivity: output.sensitivity }),
      ...(output.retention === undefined ? {} : { retention: output.retention }),
      path: `${outputDirectory(input.runId, id)}/output-${index + 1}.bin`
    })),
    created_at: new Date().toISOString()
  };
  assertValidInvocationRequest(request);
  return request;
}

export async function invokeCommandCapability(input: {
  root: string;
  runId: string;
  stage: PlaybookStage;
  step: PlaybookStep;
}): Promise<CommandCapabilityInvocationResult> {
  const entrypoint = input.step.capability.entrypoint;
  if (!entrypoint || entrypoint.kind !== "command") {
    throw new DokionError(
      "UNSUPPORTED_EXECUTION",
      "Generic command invocation requires an explicit capability.entrypoint."
    );
  }
  const display = commandSpecDisplay(entrypoint.command);
  const candidate = await buildRequest(input);
  const requestRelative = requestPath(input.runId, candidate.invocation_id);
  const receiptRelative = receiptPath(input.runId, candidate.invocation_id);

  const existingReceipt = await loadReceiptIfPresent(
    input.root,
    receiptRelative,
    candidate
  );
  if (existingReceipt) return resultFromReceipt(existingReceipt, receiptRelative, display);

  const request = await persistRequest(input.root, requestRelative, candidate);
  await ensureEmptyOutputDirectory(input.root, input.runId, request.invocation_id);
  const requestAbsolute = absolute(input.root, requestRelative);
  const requestDigestBefore = sha256(await readFile(requestAbsolute));

  const checkpoint = await beginSideEffect(input.root, {
    runId: input.runId,
    stepId: input.step.id,
    kind: "COMMAND",
    subject: input.step.capability.id,
    idempotencyKey: `invocation:${input.runId}:${input.stage.id}:${input.step.id}`,
    parametersDigest: checkpointIntentDigest(request)
  });
  assertInvocationReplaySafe(checkpoint);

  let commandResult: Awaited<ReturnType<typeof runCommand>>;
  let terminalCheckpoint: SideEffectCheckpoint;
  try {
    commandResult = await runCommand(input.root, entrypoint.command, {
      timeoutSeconds: input.step.timeout_seconds ?? 300,
      ...(input.step.permissions?.env === undefined
        ? {}
        : { declaredEnv: input.step.permissions.env }),
      env: { DOKION_INVOCATION_REQUEST: requestRelative },
      artifactPrefix: `.dokion/evidence/${input.stage.id}/${input.step.id}/invocation-command`
    });
    if (commandResult.exitCode === 0) {
      terminalCheckpoint = await completeSideEffect(input.root, checkpoint.id, {
        status: "COMPLETED",
        resultDigest: commandCheckpointDigest({
          commandIdentity: commandResult.commandIdentity,
          exitCode: commandResult.exitCode,
          endedAt: commandResult.endedAt,
          stdoutObservedDigest: commandResult.stdoutArtifact.observedDigest,
          stderrObservedDigest: commandResult.stderrArtifact.observedDigest
        })
      });
    } else {
      terminalCheckpoint = await completeSideEffect(input.root, checkpoint.id, {
        status: "FAILED",
        errorCode: "COMMAND_FAILED"
      });
    }
  } catch (error) {
    const failure = errorDetails(error);
    terminalCheckpoint = await completeSideEffect(input.root, checkpoint.id, {
      status: "FAILED",
      errorCode: failure.code.replace(/[^A-Za-z0-9._-]/g, "_")
    });
    const now = new Date().toISOString();
    const normalized = normalizeCommandSpec(entrypoint.command);
    const receipt: InvocationReceipt = {
      schema: "dokion.invocation-receipt.v1",
      invocation_id: request.invocation_id,
      run_id: request.run_id,
      stage_id: request.stage_id,
      step_id: request.step_id,
      capability: request.capability,
      status: "FAILED",
      command: commandReceipt(request, terminalCheckpoint, {
        commandIdentity: normalized.identity,
        commandKind: normalized.kind,
        exitCode: -1,
        startedAt: checkpoint.started_at,
        endedAt: now,
        durationMs: Math.max(0, Date.parse(now) - Date.parse(checkpoint.started_at))
      }),
      inputs: request.inputs,
      outputs: [],
      failure,
      created_at: request.created_at,
      ended_at: now
    };
    await persistReceipt(input.root, receiptRelative, receipt);
    return resultFromReceipt(receipt, receiptRelative, display);
  }

  const baseCommand = commandReceipt(request, terminalCheckpoint, commandResult);
  if (commandResult.exitCode !== 0) {
    const receipt: InvocationReceipt = {
      schema: "dokion.invocation-receipt.v1",
      invocation_id: request.invocation_id,
      run_id: request.run_id,
      stage_id: request.stage_id,
      step_id: request.step_id,
      capability: request.capability,
      status: "FAILED",
      command: baseCommand,
      inputs: request.inputs,
      outputs: [],
      failure: {
        code: "COMMAND_FAILED",
        message: `Capability command exited ${commandResult.exitCode}.`
      },
      created_at: request.created_at,
      ended_at: commandResult.endedAt
    };
    await persistReceipt(input.root, receiptRelative, receipt);
    return resultFromReceipt(receipt, receiptRelative, display);
  }

  const published: InvocationReceiptOutput[] = [];
  try {
    const requestDigestAfter = sha256(await readFile(requestAbsolute));
    if (requestDigestAfter !== requestDigestBefore) {
      throw new DokionError(
        "ARTIFACT_INVALID",
        "Invocation request changed during command execution.",
        { request: requestRelative }
      );
    }

    const staged = await validateStagedOutputs(input.root, request);
    for (const item of staged) {
      const descriptor = await materializeRunArtifact({
        root: input.root,
        runId: input.runId,
        invocationId: request.invocation_id,
        stageId: input.stage.id,
        stepId: input.step.id,
        capability: request.capability,
        declaration: item.declaration,
        bytes: item.bytes
      });
      published.push({
        name: descriptor.name,
        kind: descriptor.kind as Exclude<PlaybookArtifactKind, "directory">,
        artifact: artifactRef(descriptor)
      });
    }
  } catch (error) {
    const failure = errorDetails(error);
    const endedAt = new Date().toISOString();
    const receipt: InvocationReceipt = {
      schema: "dokion.invocation-receipt.v1",
      invocation_id: request.invocation_id,
      run_id: request.run_id,
      stage_id: request.stage_id,
      step_id: request.step_id,
      capability: request.capability,
      status: "FAILED",
      command: baseCommand,
      inputs: request.inputs,
      outputs: published,
      failure,
      created_at: request.created_at,
      ended_at: endedAt
    };
    await persistReceipt(input.root, receiptRelative, receipt);
    return resultFromReceipt(receipt, receiptRelative, display);
  }

  const receipt: InvocationReceipt = {
    schema: "dokion.invocation-receipt.v1",
    invocation_id: request.invocation_id,
    run_id: request.run_id,
    stage_id: request.stage_id,
    step_id: request.step_id,
    capability: request.capability,
    status: "SUCCEEDED",
    command: baseCommand,
    inputs: request.inputs,
    outputs: published,
    created_at: request.created_at,
    ended_at: new Date().toISOString()
  };
  await persistReceipt(input.root, receiptRelative, receipt);
  return resultFromReceipt(receipt, receiptRelative, display);
}
