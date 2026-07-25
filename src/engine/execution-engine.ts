import { appendEvent } from "../state/event-log.ts";
import { writeCommandEvidence } from "../evidence/evidence-store.ts";
import { DokionError } from "../core/errors.ts";
import { assertPlaybookUnchanged, loadActivePlaybook } from "../playbook/load-playbook.ts";
import type { LoadedPlaybook, PlaybookStage, PlaybookStep } from "../playbook/types.ts";
import { writeHardeningReport } from "../report/render-hardening.ts";
import { StateStore } from "../state/state-store.ts";
import type { DokionState, StageState, StepState } from "../state/types.ts";
import { runCommand } from "./command-runner.ts";
import { assertSequentialExecution, assertStageDependencies, assertStepDependencies } from "./dependencies.ts";

interface GitContext {
  commitSha: string;
  branch?: string;
  worktreeClean?: boolean;
}

async function runGit(root: string, args: string[]): Promise<string | undefined> {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "ignore",
    stdin: "ignore"
  });
  const output = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    return undefined;
  }
  return (await output).trim();
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
  if (!stage) {
    throw new Error(`State is missing declared stage ${stageId}`);
  }
  return stage;
}

function findStepState(state: DokionState, stageId: string, stepId: string): StepState {
  const step = findStageState(state, stageId).steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    throw new Error(`State is missing declared step ${stageId}/${stepId}`);
  }
  return step;
}

function approvalPolicy(step: PlaybookStep, loaded: LoadedPlaybook): string {
  return step.approval ?? loaded.data.defaults?.approval ?? "BEFORE_WRITE";
}

function failurePolicy(step: PlaybookStep, loaded: LoadedPlaybook): string {
  return step.failure_policy ?? loaded.data.defaults?.failure_policy ?? "STOP_STAGE";
}

function isApprovalSatisfied(policy: string): boolean {
  return policy === "NEVER" || policy === "FROM_PLAYBOOK";
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
    if (!(await this.store.exists())) {
      return this.run();
    }

    const loaded = await loadActivePlaybook(this.root);
    assertSequentialExecution(loaded.data);
    let state = await this.store.load();
    if (state.run.status === "COMPLETED" || state.run.status === "TAINTED") {
      return state;
    }

    if (state.playbook.digest !== loaded.digest) {
      return this.markTainted(state, loaded.digest, "resume");
    }

    state = await this.updateState((current) => ({
      ...current,
      run: { ...current.run, status: "RUNNING" }
    }));
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "RUN_RESUMED"
    });
    return this.execute(loaded);
  }

  private async execute(loaded: LoadedPlaybook): Promise<DokionState> {
    for (const stage of loaded.data.stages) {
      let state = await this.store.load();
      const currentStage = findStageState(state, stage.id);
      if (currentStage.status === "SUCCEEDED") {
        continue;
      }

      assertStageDependencies(stage, state);
      state = await this.updateState((current) => {
        const target = findStageState(current, stage.id);
        target.status = "IN_PROGRESS";
        target.started_at ??= new Date().toISOString();
        return current;
      });

      for (const step of stage.steps) {
        state = await this.store.load();
        const currentStep = findStepState(state, stage.id, step.id);
        if (currentStep.status === "SUCCEEDED" || currentStep.status.startsWith("SKIPPED_")) {
          continue;
        }

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
          return current;
        });

        const policy = approvalPolicy(step, loaded);
        if (!isApprovalSatisfied(policy)) {
          state = await this.updateState((current) => {
            current.run.status = "AWAITING_USER";
            const target = findStepState(current, stage.id, step.id);
            target.status = "AWAITING_APPROVAL";
            target.approval = { policy, granted: false };
            target.failure_reason = `Approval policy ${policy} requires an external user decision`;
            return current;
          });
          await appendEvent(this.root, {
            at: new Date().toISOString(),
            run_id: state.run.id,
            event: "APPROVAL_REQUIRED",
            stage_id: stage.id,
            step_id: step.id,
            detail: policy
          });
          return state;
        }

        const commands = step.verification ?? [];
        if (commands.length === 0) {
          return this.blockStep(stage, step, loaded, "No verification command is declared for this M0-M2 runtime step");
        }

        state = await this.updateState((current) => {
          const target = findStepState(current, stage.id, step.id);
          target.status = "IN_PROGRESS";
          target.started_at ??= new Date().toISOString();
          target.attempts = (target.attempts ?? 0) + 1;
          return current;
        });
        await appendEvent(this.root, {
          at: new Date().toISOString(),
          run_id: state.run.id,
          event: "STEP_STARTED",
          stage_id: stage.id,
          step_id: step.id
        });

        for (const [index, command] of commands.entries()) {
          const allowed = step.permissions?.shell ?? [];
          if (!allowed.includes(command)) {
            state = await this.updateState((current) => {
              const target = findStepState(current, stage.id, step.id);
              target.status = "FAILED";
              target.failure_reason = "Verification command is outside permissions.shell";
              target.scope_violations = [
                ...(target.scope_violations ?? []),
                {
                  attempted: command,
                  declared_scope: JSON.stringify(allowed),
                  blocked: true,
                  at: new Date().toISOString()
                }
              ];
              target.applied_failure_policy = failurePolicy(step, loaded);
              current.run.status = "FAILED";
              current.run.ended_at = new Date().toISOString();
              return current;
            });
            return state;
          }

          let result;
          try {
            result = await runCommand(this.root, command, step.timeout_seconds ?? 300);
          } catch (error) {
            return this.failStep(stage, step, loaded, error instanceof Error ? error.message : String(error));
          }

          const latest = await this.store.load();
          const artifact = await writeCommandEvidence(this.root, {
            run_id: latest.run.id,
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
            ...(latest.baseline?.commit ? { commit_sha: latest.baseline.commit } : {})
          });

          state = await this.updateState((current) => {
            const target = findStepState(current, stage.id, step.id);
            target.verification_results = [
              ...(target.verification_results ?? []),
              { command, exit_code: result.exitCode, artifact, ran_at: result.endedAt }
            ];
            target.evidence = [...(target.evidence ?? []), artifact];
            return current;
          });

          if (result.exitCode !== 0) {
            return this.failStep(stage, step, loaded, `Verification command exited ${result.exitCode}`);
          }
        }

        state = await this.updateState((current) => {
          const target = findStepState(current, stage.id, step.id);
          target.status = "SUCCEEDED";
          target.ended_at = new Date().toISOString();
          target.success_conditions_met = step.success_conditions?.length
            ? [...step.success_conditions]
            : ["verification_exit_zero"];
          target.success_conditions_unmet = [];
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

      if (findStageState(state, stage.id).status !== "SUCCEEDED") {
        return state;
      }
    }

    const completed = await this.updateState((state) => ({
      ...state,
      run: { ...state.run, status: "COMPLETED", ended_at: new Date().toISOString() }
    }));
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: completed.run.id,
      event: "RUN_COMPLETED"
    });
    return completed;
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

  private async blockStep(stage: PlaybookStage, step: PlaybookStep, loaded: LoadedPlaybook, reason: string): Promise<DokionState> {
    const state = await this.updateState((current) => {
      const target = findStepState(current, stage.id, step.id);
      target.status = "BLOCKED";
      target.failure_reason = reason;
      target.applied_failure_policy = failurePolicy(step, loaded);
      current.run.status = "BLOCKED";
      current.run.ended_at = new Date().toISOString();
      return current;
    });
    await appendEvent(this.root, {
      at: new Date().toISOString(),
      run_id: state.run.id,
      event: "STEP_BLOCKED",
      stage_id: stage.id,
      step_id: step.id,
      detail: reason
    });
    return state;
  }

  private async failStep(stage: PlaybookStage, step: PlaybookStep, loaded: LoadedPlaybook, reason: string): Promise<DokionState> {
    const policy = failurePolicy(step, loaded);
    const state = await this.updateState((current) => {
      const target = findStepState(current, stage.id, step.id);
      target.status = "FAILED";
      target.failure_reason = reason;
      target.applied_failure_policy = policy;
      target.ended_at = new Date().toISOString();
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
