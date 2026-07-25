import { isApproved, latestDecision } from "../approvals/approval-store.ts";
import { DokionError } from "../core/errors.ts";
import { writeCommandEvidence } from "../evidence/evidence-store.ts";
import { assertPlaybookUnchanged, loadActivePlaybook } from "../playbook/load-playbook.ts";
import type { LoadedPlaybook, PlaybookStage, PlaybookStep } from "../playbook/types.ts";
import { writeHardeningReport } from "../report/render-hardening.ts";
import { appendEvent } from "../state/event-log.ts";
import { StateStore } from "../state/state-store.ts";
import type { DokionState, StageState, StepState, VerificationResult } from "../state/types.ts";
import { runAnalyzeCapability, runRemediationCapability, type CapabilityRunResult } from "./capability-runner.ts";
import { runCommand } from "./command-runner.ts";
import { assertSequentialExecution, assertStageDependencies, assertStepDependencies } from "./dependencies.ts";

interface GitContext {
  commitSha: string;
  branch?: string;
  worktreeClean?: boolean;
}

async function runGit(root: string, args: string[]): Promise<string | undefined> {
  const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "ignore", stdin: "ignore" });
  const output = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const exitCode = await child.exited;
  return exitCode === 0 ? (await output).trim() : undefined;
}

async function inspectGit(root: string): Promise<GitContext> {
  const commitSha = await runGit(root, ["rev-parse", "HEAD"]);
  const branch = await runGit(root, ["branch", "--show-current"]);
  const status = await runGit(root, ["status", "--porcelain"]);
  return {
    commitSha: commitSha && /^[a-fA-F0-9]{7,40}$/.test(commitSha) ? commitSha : "0000000",
    ...(branch ? { branch } : {}),
    ...(status !== undefined ? { worktreeClean: status.length === 0 } : {})
  };
}

function findStageState(state: DokionState, stageId: string): StageState {
  const stage = state.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`State is missing declared stage ${stageId}`);
  return stage;
}

function findStepState(state: DokionState, stageId: string, stepId: string): StepState {
  const step = findStageState(state, stageId).steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`State is missing declared step ${stageId}/${stepId}`);
  return step;
}

function failurePolicy(step: PlaybookStep, loaded: LoadedPlaybook): string {
  return step.failure_policy ?? loaded.data.defaults?.failure_policy ?? "STOP_STAGE";
}

function stepApprovalSatisfied(step: PlaybookStep, loaded: LoadedPlaybook, state: DokionState): boolean {
  const policy = step.approval ?? loaded.data.defaults?.approval ?? "BEFORE_WRITE";
  if (policy === "NEVER" || policy === "FROM_PLAYBOOK" || policy === "BEFORE_EACH_FIX") return true;
  return isApproved(state, `step:${step.id}`);
}

function resultEvidence(result: CapabilityRunResult): {
  evidence: string[];
  verificationResults: VerificationResult[];
  findingIds: string[];
} {
  return {
    evidence: result.evidence,
    verificationResults: result.verificationResults,
    findingIds: result.findingIds
  };
}

export class ExecutionEngine {
  readonly root: string;
  readonly store: StateStore;

  constructor(root: string) {
    this.root = root;
    this.store = new StateStore(root);
  }

  async run(): Promise<DokionState> {
    const loaded = await loadActivePlaybook(this.root);
    assertSequentialExecution(loaded.data);
    const git = await inspectGit(this.root);
    const state = await this.store.initialize({
      playbookDigest: loaded.digest,
      commitSha: git.commitSha,
      ...(git.branch ? { branch: git.branch } : {}),
      ...(git.worktreeClean !== undefined ? { worktreeClean: git.worktreeClean } : {}),
      agent: "other",
      stages: loaded.data.stages.map((stage) => ({
        id: stage.id,
        steps: stage.steps.map((step) => ({ id: step.id, mode: step.mode }))
      }))
    });
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "RUN_STARTED",
      data: { playbook_digest: loaded.digest }
    });
    await writeHardeningReport(this.root, state);
    return this.execute(loaded);
  }

  async resume(): Promise<DokionState> {
    if (!(await this.store.exists())) return this.run();
    const loaded = await loadActivePlaybook(this.root);
    assertSequentialExecution(loaded.data);
    let state = await this.store.load();
    if (state.run.status === "COMPLETED" || state.run.status === "TAINTED") return state;
    if (state.playbook.digest !== loaded.digest) return this.markTainted(state, loaded.digest, "resume");

    state = await this.updateState((current) => {
      const run = { ...current.run, status: "RUNNING" as const };
      delete run.ended_at;
      return { ...current, run };
    });
    await appendEvent(this.root, { at: new Date().toISOString(), run_id: state.run.id, event: "RUN_RESUMED" });
    return this.execute(loaded);
  }

  private async execute(loaded: LoadedPlaybook): Promise<DokionState> {
    for (const stage of loaded.data.stages) {
      let state = await this.store.load();
      if (findStageState(state, stage.id).status === "SUCCEEDED") continue;
      assertStageDependencies(stage, state);
      state = await this.updateState((current) => {
        const target = findStageState(current, stage.id);
        target.status = "IN_PROGRESS";
        target.started_at ??= new Date().toISOString();
        delete target.ended_at;
        return current;
      });

      for (const step of stage.steps) {
        state = await this.store.load();
        const stepState = findStepState(state, stage.id, step.id);
        if (stepState.status === "SUCCEEDED" || stepState.status.startsWith("SKIPPED_")) continue;

        try {
          await assertPlaybookUnchanged(loaded);
        } catch (error) {
          if (error instanceof DokionError && error.code === "PLAYBOOK_TAINTED") {
            const observed = typeof error.details.observed === "string" ? error.details.observed : "unknown";
            return this.markTainted(state, observed, step.id);
          }
          throw error;
        }

        assertStepDependencies(step, state);
        state = await this.updateState((current) => {
          current.playbook.last_verified_before_step = step.id;
          current.playbook.verified_at = new Date().toISOString();
          const target = findStepState(current, stage.id, step.id);
          target.status = "IN_PROGRESS";
          target.started_at ??= new Date().toISOString();
          delete target.ended_at;
          target.attempts = (target.attempts ?? 0) + 1;
          delete target.failure_reason;
          return current;
        });
        await appendEvent(this.root, {
          at: new Date().toISOString(),
          run_id: state.run.id,
          event: "STEP_STARTED",
          stage_id: stage.id,
          step_id: step.id
        });

        if (!stepApprovalSatisfied(step, loaded, state) && !["FIX_WITH_APPROVAL", "FIX_AUTOMATICALLY"].includes(step.mode)) {
          return this.awaitApproval(stage, step, loaded, `step:${step.id}`);
        }

        let result: CapabilityRunResult;
        try {
          if (step.mode === "ANALYZE") {
            result = await runAnalyzeCapability({ root: this.root, loaded, state, stage, step });
          } else if (step.mode === "FIX_WITH_APPROVAL" || step.mode === "FIX_AUTOMATICALLY") {
            result = await runRemediationCapability({ root: this.root, loaded, state, stage, step });
          } else {
            result = await this.runVerificationOnly(stage, step, state);
          }
        } catch (error) {
          return this.failStep(stage, step, loaded, error instanceof Error ? error.message : String(error));
        }

        if (result.status === "AWAITING_APPROVAL") {
          return this.awaitApproval(stage, step, loaded, result.subject, resultEvidence(result));
        }
        if (result.status === "FAILED") {
          return this.failStep(stage, step, loaded, result.reason, resultEvidence(result));
        }

        state = await this.updateState((current) => {
          const target = findStepState(current, stage.id, step.id);
          target.status = "SUCCEEDED";
          target.ended_at = new Date().toISOString();
          target.findings = Array.from(new Set([...(target.findings ?? []), ...result.findingIds]));
          target.evidence = Array.from(new Set([...(target.evidence ?? []), ...result.evidence]));
          target.verification_results = [...(target.verification_results ?? []), ...result.verificationResults];
          target.success_conditions_met = step.success_conditions?.length ? [...step.success_conditions] : ["execution_evidence_recorded"];
          target.success_conditions_unmet = [];
          if (target.approval) {
            target.approval.granted = true;
          }
          return current;
        });
        await appendEvent(this.root, {
          at: new Date().toISOString(),
          run_id: state.run.id,
          event: "STEP_SUCCEEDED",
          stage_id: stage.id,
          step_id: step.id
        });
      }

      state = await this.updateState((current) => {
        const target = findStageState(current, stage.id);
        const allSucceeded = target.steps.every((step) => step.status === "SUCCEEDED" || step.status.startsWith("SKIPPED_"));
        target.status = allSucceeded ? "SUCCEEDED" : "FAILED";
        target.ended_at = new Date().toISOString();
        return current;
      });
      if (findStageState(state, stage.id).status !== "SUCCEEDED") return state;
    }

    const completed = await this.updateState((state) => ({
      ...state,
      run: { ...state.run, status: "COMPLETED", ended_at: new Date().toISOString() }
    }));
    await appendEvent(this.root, { at: new Date().toISOString(), run_id: completed.run.id, event: "RUN_COMPLETED" });
    return completed;
  }

  private async runVerificationOnly(stage: PlaybookStage, step: PlaybookStep, state: DokionState): Promise<CapabilityRunResult> {
    const commands = step.verification ?? [];
    if (commands.length === 0) {
      return { status: "FAILED", reason: "No verification command is declared", findingIds: [], evidence: [], verificationResults: [] };
    }
    const evidence: string[] = [];
    const verificationResults: VerificationResult[] = [];
    for (const [index, command] of commands.entries()) {
      if (!(step.permissions?.shell ?? []).includes(command)) {
        return { status: "FAILED", reason: "Verification command is outside permissions.shell", findingIds: [], evidence, verificationResults };
      }
      const result = await runCommand(this.root, command, step.timeout_seconds ?? 300);
      const artifact = await writeCommandEvidence(this.root, {
        run_id: state.run.id,
        stage_id: stage.id,
        step_id: step.id,
        command_index: index + 1,
        command,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exitCode,
        started_at: result.startedAt,
        ended_at: result.endedAt,
        duration_ms: result.durationMs,
        ...(state.baseline?.commit ? { commit_sha: state.baseline.commit } : {})
      });
      evidence.push(artifact);
      verificationResults.push({ command, exit_code: result.exitCode, artifact, ran_at: result.endedAt });
      if (result.exitCode !== 0) {
        return { status: "FAILED", reason: `Verification command exited ${result.exitCode}`, findingIds: [], evidence, verificationResults };
      }
    }
    return { status: "SUCCEEDED", findingIds: [], evidence, verificationResults };
  }

  private async awaitApproval(
    stage: PlaybookStage,
    step: PlaybookStep,
    loaded: LoadedPlaybook,
    subject: string,
    partial: { evidence: string[]; verificationResults: VerificationResult[]; findingIds: string[] } = { evidence: [], verificationResults: [], findingIds: [] }
  ): Promise<DokionState> {
    const state = await this.updateState((current) => {
      current.run.status = "AWAITING_USER";
      const target = findStepState(current, stage.id, step.id);
      const decision = latestDecision(current, subject);
      target.status = "AWAITING_APPROVAL";
      target.approval = {
        policy: step.approval ?? loaded.data.defaults?.approval ?? "BEFORE_WRITE",
        granted: false,
        ...(decision?.by ? { granted_by: decision.by } : {}),
        ...(decision?.at ? { granted_at: decision.at } : {}),
        scope: subject
      };
      target.failure_reason = `Approval required for ${subject}`;
      target.findings = Array.from(new Set([...(target.findings ?? []), ...partial.findingIds]));
      target.evidence = Array.from(new Set([...(target.evidence ?? []), ...partial.evidence]));
      target.verification_results = [...(target.verification_results ?? []), ...partial.verificationResults];
      return current;
    });
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "APPROVAL_REQUIRED",
      stage_id: stage.id,
      step_id: step.id,
      detail: subject
    });
    return state;
  }

  private async updateState(mutator: (state: DokionState) => DokionState): Promise<DokionState> {
    const state = await this.store.update(mutator);
    await writeHardeningReport(this.root, state);
    return state;
  }

  private async markTainted(state: DokionState, observed: string, beforeStep: string): Promise<DokionState> {
    const tainted = await this.updateState((current) => ({
      ...current,
      run: { ...current.run, status: "TAINTED", ended_at: new Date().toISOString() },
      playbook: {
        ...current.playbook,
        tainted: {
          expected: current.playbook.digest,
          observed,
          detected_at: new Date().toISOString(),
          detected_before_step: beforeStep
        }
      }
    }));
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "PLAYBOOK_TAINTED",
      step_id: beforeStep,
      data: { expected: state.playbook.digest, observed }
    });
    return tainted;
  }

  private async failStep(
    stage: PlaybookStage,
    step: PlaybookStep,
    loaded: LoadedPlaybook,
    reason: string,
    partial: { evidence: string[]; verificationResults: VerificationResult[]; findingIds: string[] } = { evidence: [], verificationResults: [], findingIds: [] }
  ): Promise<DokionState> {
    const policy = failurePolicy(step, loaded);
    const state = await this.updateState((current) => {
      const target = findStepState(current, stage.id, step.id);
      target.status = policy === "MARK_BLOCKED" ? "BLOCKED" : "FAILED";
      target.failure_reason = reason;
      target.applied_failure_policy = policy;
      target.ended_at = new Date().toISOString();
      target.findings = Array.from(new Set([...(target.findings ?? []), ...partial.findingIds]));
      target.evidence = Array.from(new Set([...(target.evidence ?? []), ...partial.evidence]));
      target.verification_results = [...(target.verification_results ?? []), ...partial.verificationResults];
      const stageState = findStageState(current, stage.id);
      stageState.status = "FAILED";
      stageState.ended_at = new Date().toISOString();
      current.run.status = policy === "MARK_BLOCKED" ? "BLOCKED" : "FAILED";
      current.run.ended_at = new Date().toISOString();
      return current;
    });
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "STEP_FAILED",
      stage_id: stage.id,
      step_id: step.id,
      detail: reason,
      data: { failure_policy: policy }
    });
    return state;
  }
}
