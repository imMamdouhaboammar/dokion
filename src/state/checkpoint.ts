import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";

export type SideEffectKind = "COMMAND" | "FILE_WRITE" | "NETWORK" | "INSTALL" | "REPAIR" | "OTHER";
export type SideEffectStatus = "STARTED" | "STARTED_UNKNOWN" | "COMPLETED" | "FAILED";

export interface SideEffectIntent {
  runId: string;
  stepId: string;
  kind: SideEffectKind;
  subject: string;
  idempotencyKey: string;
  parametersDigest: string;
  startedAt?: string;
}

export interface SideEffectOutcome {
  status: "COMPLETED" | "FAILED";
  at?: string;
  resultDigest?: string;
  evidence?: readonly string[];
  errorCode?: string;
}

export interface SideEffectCheckpoint {
  schema_version: 1;
  id: string;
  revision: number;
  status: SideEffectStatus;
  run_id: string;
  step_id: string;
  kind: SideEffectKind;
  subject: string;
  intent_digest: string;
  parameters_digest: string;
  started_at: string;
  recovery_observed_at?: string;
  completed_at?: string;
  result_digest?: string;
  evidence?: string[];
  error_code?: string;
}

const DIGEST = /^(?:sha256:[a-fA-F0-9]{64}|sha512:[a-fA-F0-9]{128})$/;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const KINDS = new Set<SideEffectKind>(["COMMAND", "FILE_WRITE", "NETWORK", "INSTALL", "REPAIR", "OTHER"]);

function requireDate(field: string, value: string | undefined): string {
  const resolved = value ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(resolved))) {
    throw new DokionError("INVALID_STATE", `Side-effect checkpoint requires a valid ${field}`, { field });
  }
  return resolved;
}

function requireDigest(field: string, value: string | undefined): string {
  if (!value || !DIGEST.test(value)) {
    throw new DokionError("INVALID_STATE", `Side-effect checkpoint requires an immutable ${field}`, { field });
  }
  return value;
}

function requireIdentifier(field: string, value: string): string {
  if (!IDENTIFIER.test(value)) {
    throw new DokionError("INVALID_STATE", `Side-effect checkpoint requires a valid ${field}`, { field });
  }
  return value;
}

function requireSubject(value: string): string {
  const subject = value.trim();
  const unsafe = !subject
    || subject.length > 256
    || subject.startsWith("/")
    || subject.includes("\\")
    || subject.split("/").includes("..")
    || /[\u0000-\u001f]/.test(subject);
  if (unsafe) {
    throw new DokionError("INVALID_STATE", "Side-effect subject is unsafe", { field: "subject" });
  }
  return subject;
}

function checkpointDirectory(root: string): string {
  return join(root, ".dokion", "checkpoints", "side-effects");
}

function checkpointPath(root: string, id: string): string {
  if (!/^side-effect-[a-f0-9]{32}$/.test(id)) {
    throw new DokionError("INVALID_STATE", "Side-effect checkpoint id is invalid", { field: "id" });
  }
  return join(checkpointDirectory(root), `${id}.json`);
}

function stableIntent(input: SideEffectIntent): {
  id: string;
  intentDigest: string;
  runId: string;
  stepId: string;
  kind: SideEffectKind;
  subject: string;
  parametersDigest: string;
  startedAt: string;
} {
  const runId = requireIdentifier("run id", input.runId);
  const stepId = requireIdentifier("step id", input.stepId);
  if (!KINDS.has(input.kind)) {
    throw new DokionError("INVALID_STATE", "Side-effect kind is invalid", { field: "kind" });
  }
  const subject = requireSubject(input.subject);
  if (!input.idempotencyKey.trim()) {
    throw new DokionError("INVALID_STATE", "Side-effect idempotency key is required", { field: "idempotencyKey" });
  }
  const parametersDigest = requireDigest("parameters digest", input.parametersDigest);
  const canonical = JSON.stringify({
    runId,
    stepId,
    kind: input.kind,
    subject,
    idempotencyKey: input.idempotencyKey,
    parametersDigest
  });
  const intentDigest = sha256(canonical);
  return {
    id: `side-effect-${intentDigest.slice("sha256:".length, "sha256:".length + 32)}`,
    intentDigest,
    runId,
    stepId,
    kind: input.kind,
    subject,
    parametersDigest,
    startedAt: requireDate("start time", input.startedAt)
  };
}

async function loadCheckpoint(root: string, id: string): Promise<SideEffectCheckpoint> {
  const checkpoint = await readJson<SideEffectCheckpoint>(checkpointPath(root, id));
  if (checkpoint.schema_version !== 1 || checkpoint.id !== id || checkpoint.revision < 1) {
    throw new DokionError("INVALID_STATE", "Persisted side-effect checkpoint is invalid", { id });
  }
  return checkpoint;
}

export async function beginSideEffect(
  root: string,
  intent: SideEffectIntent
): Promise<SideEffectCheckpoint> {
  const stable = stableIntent(intent);
  const path = checkpointPath(root, stable.id);
  if (await Bun.file(path).exists()) {
    const existing = await loadCheckpoint(root, stable.id);
    if (existing.intent_digest !== stable.intentDigest) {
      throw new DokionError("INVALID_STATE", "Side-effect checkpoint identity collision", { id: stable.id });
    }
    return existing;
  }

  const checkpoint: SideEffectCheckpoint = {
    schema_version: 1,
    id: stable.id,
    revision: 1,
    status: "STARTED",
    run_id: stable.runId,
    step_id: stable.stepId,
    kind: stable.kind,
    subject: stable.subject,
    intent_digest: stable.intentDigest,
    parameters_digest: stable.parametersDigest,
    started_at: stable.startedAt
  };

  try {
    await writeJsonAtomic(path, checkpoint);
    return checkpoint;
  } catch (error) {
    if (await Bun.file(path).exists()) {
      const existing = await loadCheckpoint(root, stable.id);
      if (existing.intent_digest === stable.intentDigest) return existing;
    }
    throw error;
  }
}

function normalizedEvidence(evidence: readonly string[] | undefined): string[] {
  const values = [...new Set(evidence ?? [])].sort();
  for (const path of values) {
    if (!path.startsWith(".dokion/evidence/") || path.split("/").includes("..")) {
      throw new DokionError("INVALID_STATE", "Side-effect evidence path is invalid", { field: "evidence" });
    }
  }
  return values;
}

function normalizeOutcome(outcome: SideEffectOutcome): {
  status: "COMPLETED" | "FAILED";
  at: string;
  resultDigest?: string;
  evidence: string[];
  errorCode?: string;
} {
  const at = requireDate("completion time", outcome.at);
  const evidence = normalizedEvidence(outcome.evidence);
  if (outcome.status === "COMPLETED") {
    return {
      status: "COMPLETED",
      at,
      resultDigest: requireDigest("result digest", outcome.resultDigest),
      evidence
    };
  }
  const errorCode = requireIdentifier("error code", outcome.errorCode ?? "");
  return { status: "FAILED", at, evidence, errorCode };
}

function terminalMatches(
  checkpoint: SideEffectCheckpoint,
  outcome: ReturnType<typeof normalizeOutcome>
): boolean {
  return checkpoint.status === outcome.status
    && checkpoint.completed_at === outcome.at
    && checkpoint.result_digest === outcome.resultDigest
    && checkpoint.error_code === outcome.errorCode
    && JSON.stringify(checkpoint.evidence ?? []) === JSON.stringify(outcome.evidence);
}

export async function completeSideEffect(
  root: string,
  id: string,
  outcomeInput: SideEffectOutcome
): Promise<SideEffectCheckpoint> {
  const current = await loadCheckpoint(root, id);
  const outcome = normalizeOutcome(outcomeInput);
  if (current.status === "COMPLETED" || current.status === "FAILED") {
    if (terminalMatches(current, outcome)) return current;
    throw new DokionError("INVALID_STATE", "Side-effect checkpoint already has a different terminal outcome", { id });
  }
  if (current.status !== "STARTED" && current.status !== "STARTED_UNKNOWN") {
    throw new DokionError("INVALID_STATE", "Side-effect checkpoint cannot transition from its current status", {
      id,
      status: current.status
    });
  }

  const completed: SideEffectCheckpoint = {
    ...current,
    revision: current.revision + 1,
    status: outcome.status,
    completed_at: outcome.at,
    ...(outcome.resultDigest ? { result_digest: outcome.resultDigest } : {}),
    ...(outcome.evidence.length > 0 ? { evidence: outcome.evidence } : {}),
    ...(outcome.errorCode ? { error_code: outcome.errorCode } : {})
  };
  await writeJsonAtomic(checkpointPath(root, id), completed);
  return completed;
}

export async function recoverStartedSideEffects(
  root: string,
  observedAt?: string
): Promise<SideEffectCheckpoint[]> {
  const directory = checkpointDirectory(root);
  const at = requireDate("recovery observation time", observedAt);
  let files: string[];
  try {
    files = (await readdir(directory))
      .filter((path) => /^side-effect-[a-f0-9]{32}\.json$/.test(path))
      .sort();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }

  const recovered: SideEffectCheckpoint[] = [];
  for (const file of files) {
    const id = file.slice(0, -".json".length);
    const current = await loadCheckpoint(root, id);
    if (current.status !== "STARTED") continue;
    const updated: SideEffectCheckpoint = {
      ...current,
      revision: current.revision + 1,
      status: "STARTED_UNKNOWN",
      recovery_observed_at: at
    };
    await writeJsonAtomic(checkpointPath(root, id), updated);
    recovered.push(updated);
  }
  return recovered;
}
