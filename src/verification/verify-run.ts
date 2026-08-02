import { detectPlatform, evaluateApplicability } from "../applicability/evaluate-applicability.ts";
import { DokionError } from "../core/errors.ts";
import { listFindings } from "../findings/finding-store.ts";
import { captureRepositoryIdentity } from "../git/repository-identity.ts";
import { inspectProject } from "../inspect/project-inspector.ts";
import { loadActivePlaybook } from "../playbook/load-playbook.ts";
import { evaluateReleaseGates } from "../readiness/release-gates.ts";
import { StateStore } from "../state/state-store.ts";
import type { DokionState, ReleaseGateState, VerificationResult } from "../state/types.ts";
import {
  executeStepVerification,
  stepVerificationEvidenceRoot,
  type StepVerificationExecution
} from "./step-verification.ts";

export interface DeclaredVerificationResult {
  scope: "STEP" | "RELEASE_GATE";
  gateId: string;
  blocking: boolean;
  status: ReleaseGateState["status"];
  passed: boolean;
  disposition?: "EXECUTED" | "INAPPLICABLE" | "DENIED";
  reason?: string;
  stageId?: string;
  stepId?: string;
  commandIndex?: number;
  command?: string;
  exitCode?: number;
  artifact?: string;
  ranAt?: string;
}

export interface VerifyCommandResult {
  schemaVersion: "dokion.verify.v1";
  verificationAttempt: string;
  verifiedAt: string;
  runId: string;
  playbookDigest: string;
  repositoryCommit: string | null;
  worktreeId: string;
  stateRevision: number;
  configuredGates: number;
  executedCommands: number;
  evidence: string[];
  results: DeclaredVerificationResult[];
  limitations: string[];
  passed: boolean;
  status: "PASS" | "FAIL";
  message: string;
}

interface StepBatchRecord {
  stageId: string;
  stepId: string;
  blocking: boolean;
  commands: string[];
  evidence: string[];
  verificationResults: VerificationResult[];
  executions: StepVerificationExecution[];
  applicable: boolean;
  reason?: string;
}

function releaseGateResults(gates: ReleaseGateState[]): DeclaredVerificationResult[] {
  return gates.map((gate) => ({
    scope: "RELEASE_GATE",
    gateId: gate.id,
    blocking: gate.blocking,
    status: gate.status,
    passed: gate.status === "PASS",
    disposition: "EXECUTED",
    ...(gate.evaluated ? { command: gate.evaluated } : {}),
    ...(gate.exit_code !== undefined ? { exitCode: gate.exit_code } : {}),
    ...(gate.artifact ? { artifact: gate.artifact } : {}),
    ...(gate.ran_at ? { ranAt: gate.ran_at } : {})
  }));
}

function stepResults(records: StepBatchRecord[]): DeclaredVerificationResult[] {
  return records.flatMap((record) => {
    const executed = record.executions.map((execution) => ({
      scope: "STEP" as const,
      gateId: `${record.stageId}/${record.stepId}/verification-${execution.commandIndex}`,
      blocking: execution.blocking,
      status: execution.passed ? "PASS" as const : "FAIL" as const,
      passed: execution.passed,
      disposition: "EXECUTED" as const,
      stageId: execution.stageId,
      stepId: execution.stepId,
      commandIndex: execution.commandIndex,
      command: execution.command,
      exitCode: execution.exitCode,
      artifact: execution.artifact,
      ranAt: execution.ranAt
    }));
    if (executed.length === record.commands.length) return executed;
    return [
      ...executed,
      ...record.commands.slice(executed.length).map((command, offset) => ({
        scope: "STEP" as const,
        gateId: `${record.stageId}/${record.stepId}/verification-${executed.length + offset + 1}`,
        blocking: record.blocking,
        status: "FAIL" as const,
        passed: false,
        disposition: record.applicable ? "DENIED" as const : "INAPPLICABLE" as const,
        ...(record.reason ? { reason: record.reason } : {}),
        stageId: record.stageId,
        stepId: record.stepId,
        commandIndex: executed.length + offset + 1,
        command
      }))
    ];
  });
}

function limitations(results: DeclaredVerificationResult[]): string[] {
  if (results.length === 0) return ["NO_DECLARED_VERIFICATION_OR_RELEASE_GATES"];
  return results
    .filter((result) => !result.passed)
    .map((result) => `${result.scope}:${result.gateId}:FAIL:${result.blocking ? "BLOCKING" : "NON_BLOCKING"}${result.reason ? `:${result.reason}` : ""}`)
    .sort();
}

function assertVerificationStateTopology(
  state: DokionState,
  records: ReadonlyArray<{ stageId: string; stepId: string }>
): void {
  for (const record of records) {
    const stage = state.stages.find((candidate) => candidate.id === record.stageId);
    const step = stage?.steps.find((candidate) => candidate.id === record.stepId);
    if (!stage || !step) {
      throw new DokionError("INVALID_STATE", "Persisted state is missing a declared verification step", {
        stageId: record.stageId,
        stepId: record.stepId
      });
    }
  }
}

function appendStepEvidence(
  state: DokionState,
  records: StepBatchRecord[]
): DokionState {
  assertVerificationStateTopology(state, records);
  for (const record of records) {
    const stage = state.stages.find((candidate) => candidate.id === record.stageId)!;
    const step = stage.steps.find((candidate) => candidate.id === record.stepId)!;
    step.evidence = Array.from(new Set([...(step.evidence ?? []), ...record.evidence]));
    step.verification_results = [
      ...(step.verification_results ?? []),
      ...record.verificationResults
    ];
  }
  return state;
}

export async function verifyDeclaredGates(root: string): Promise<VerifyCommandResult> {
  const loaded = await loadActivePlaybook(root);
  const store = new StateStore(root);
  const state = await store.load();
  if (state.playbook.digest !== loaded.digest) {
    throw new DokionError("PLAYBOOK_TAINTED", "Active Playbook does not match the persisted run authority", {
      expected: state.playbook.digest,
      observed: loaded.digest,
      path: state.playbook.path
    });
  }

  const verificationTopology = loaded.data.stages.flatMap((stage) =>
    stage.steps
      .filter((step) => (step.verification?.length ?? 0) > 0)
      .map((step) => ({ stageId: stage.id, stepId: step.id }))
  );
  assertVerificationStateTopology(state, verificationTopology);

  const verifiedAt = new Date().toISOString();
  const verificationAttempt = `verify-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const repositoryIdentity = await captureRepositoryIdentity(root, loaded.digest);
  const profile = await inspectProject(root);
  const platform = detectPlatform();
  const stepBatches: StepBatchRecord[] = [];

  for (const stage of loaded.data.stages) {
    const stageApplicability = await evaluateApplicability({
      root,
      platform,
      profile,
      applicability: stage.applicability
    });

    for (const step of stage.steps) {
      const commands = step.verification ?? [];
      if (commands.length === 0) continue;

      const stepApplicability = stageApplicability.applicable
        ? await evaluateApplicability({
            root,
            platform,
            profile,
            applicability: step.applicability
          })
        : stageApplicability;

      if (!stepApplicability.applicable) {
        stepBatches.push({
          stageId: stage.id,
          stepId: step.id,
          blocking: step.required !== false,
          commands,
          evidence: [],
          verificationResults: [],
          executions: [],
          applicable: false,
          reason: stepApplicability.reason
        });
        continue;
      }

      const evidenceRoot = stepVerificationEvidenceRoot(
        `.dokion/evidence/${state.run.id}/verify/${verificationAttempt}/steps`,
        stage.id,
        step.id
      );
      const batch = await executeStepVerification({
        root,
        stage,
        step,
        runId: state.run.id,
        ...(repositoryIdentity.commit ? { commitSha: repositoryIdentity.commit } : {}),
        evidenceRoot,
        stopOnFailure: false
      });
      stepBatches.push({
        stageId: stage.id,
        stepId: step.id,
        blocking: step.required !== false,
        commands,
        evidence: batch.evidence,
        verificationResults: batch.verificationResults,
        executions: batch.executions,
        applicable: true,
        ...(batch.reason ? { reason: batch.reason } : {})
      });
    }
  }

  const findings = await listFindings(root);
  const releaseGates = await evaluateReleaseGates({
    root,
    playbook: loaded.data,
    state,
    findings,
    forceRerun: true,
    evidenceAttempt: verificationAttempt,
    ...(repositoryIdentity.commit ? { evidenceCommitSha: repositoryIdentity.commit } : {})
  });
  const results = [...stepResults(stepBatches), ...releaseGateResults(releaseGates)];
  const qualifiedLimitations = limitations(results);
  const blockingFailure = results.some((result) => result.blocking && !result.passed);
  const passed = results.length > 0 && !blockingFailure;

  const persisted = await store.update(state.revision, (current) => {
    const next = appendStepEvidence(current, stepBatches);
    next.release_gates = releaseGates;
    next.playbook.verified_at = verifiedAt;
    return next;
  });

  return {
    schemaVersion: "dokion.verify.v1",
    verificationAttempt,
    verifiedAt,
    runId: state.run.id,
    playbookDigest: loaded.digest,
    repositoryCommit: repositoryIdentity.commit ?? null,
    worktreeId: repositoryIdentity.worktree_id,
    stateRevision: persisted.revision,
    configuredGates: results.length,
    executedCommands: results.filter((result) => result.exitCode !== undefined).length,
    evidence: results.flatMap((result) => result.artifact ? [result.artifact] : []),
    results,
    limitations: qualifiedLimitations,
    passed,
    status: passed ? "PASS" : "FAIL",
    message: passed
      ? "All blocking declared verification and release gates passed"
      : "One or more blocking declared gates failed or no gates were declared"
  };
}
