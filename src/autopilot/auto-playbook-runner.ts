import { executeAutoresearchStepLoop } from "../autoresearch/iteration-loop.ts";
import { evaluateApprovalBoundary } from "../policy/approval-policy.ts";
import type { DokionState, ExecutionStatus, StageState } from "../state/types.ts";
import { selectNextAction, type MinimalPlaybook } from "./next-action.ts";
import type { ActionSpec } from "./types.ts";

export interface CircuitBreakerConfig {
  maxRetriesPerStep: number;
  maxCostDollars: number;
  maxConsecutiveFailures: number;
  timeoutMs: number;
  enabled: boolean;
}

export interface ShadowVerificationResult {
  score: number;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; durationMs: number }>;
}

export interface StepExecutionReceipt {
  executed: boolean;
  changed: boolean;
  description: string;
  evidence?: string[];
}

export interface AutoRunnerOptions {
  playbook: MinimalPlaybook;
  state: DokionState;
  maxTurns?: number;
  targetCompletion?: number;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  enableShadowVerification?: boolean;
  enableAutoresearch?: boolean;
  verifyCommand?: string;
  guardCommand?: string;
  hasUserApproval?: boolean;
  onExecuteStep?: ((action: ActionSpec) => Promise<StepExecutionReceipt>) | undefined;
  onShadowVerify?: ((action: ActionSpec) => Promise<ShadowVerificationResult>) | undefined;
  onSelfHealingRepair?: ((stepId: string, error: Error) => Promise<boolean>) | undefined;
  onRunShellCommand?: ((command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>) | undefined;
}

export interface AutoRunnerReport {
  completed: boolean;
  completionPercentage: number;
  turnsExecuted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  selfHealingRepairsTriggered: number;
  keptChangesCount: number;
  rolledBackChangesCount: number;
  circuitBreakerStatus: "HEALTHY" | "TRIPPED" | "RECOVERED";
  estimatedCostDollars: number;
  finalState: DokionState;
  message: string;
}

interface StepAttemptResult {
  success: boolean;
  changed: boolean;
  error?: Error;
}

export class AutoPlaybookRunner {
  private playbook: MinimalPlaybook;
  private state: DokionState;
  private maxTurns: number;
  private targetCompletion: number;
  private circuitBreaker: CircuitBreakerConfig;
  private enableShadowVerification: boolean;
  private enableAutoresearch: boolean;
  private verifyCommand?: string | undefined;
  private guardCommand?: string | undefined;
  private hasUserApproval: boolean;
  private onExecuteStep?: ((action: ActionSpec) => Promise<StepExecutionReceipt>) | undefined;
  private onShadowVerify?: ((action: ActionSpec) => Promise<ShadowVerificationResult>) | undefined;
  private onSelfHealingRepair?: ((stepId: string, error: Error) => Promise<boolean>) | undefined;
  private onRunShellCommand?: ((command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>) | undefined;

  private consecutiveFailures = 0;
  private stepsSucceeded = 0;
  private stepsFailed = 0;
  private repairsTriggered = 0;
  private keptChanges = 0;
  private rolledBackChanges = 0;
  private totalCost = 0;
  private startTime = Date.now();

  constructor(options: AutoRunnerOptions) {
    this.playbook = options.playbook;
    this.state = structuredClone(options.state);
    this.maxTurns = options.maxTurns ?? 100;
    this.targetCompletion = options.targetCompletion ?? 100;
    this.enableShadowVerification = options.enableShadowVerification ?? true;
    this.enableAutoresearch = options.enableAutoresearch ?? true;
    this.verifyCommand = options.verifyCommand;
    this.guardCommand = options.guardCommand;
    this.hasUserApproval = options.hasUserApproval ?? true;
    this.onExecuteStep = options.onExecuteStep;
    this.onShadowVerify = options.onShadowVerify;
    this.onSelfHealingRepair = options.onSelfHealingRepair;
    this.onRunShellCommand = options.onRunShellCommand;

    this.circuitBreaker = {
      maxRetriesPerStep: options.circuitBreaker?.maxRetriesPerStep ?? 3,
      maxCostDollars: options.circuitBreaker?.maxCostDollars ?? 5.0,
      maxConsecutiveFailures: options.circuitBreaker?.maxConsecutiveFailures ?? 3,
      timeoutMs: options.circuitBreaker?.timeoutMs ?? 300000,
      enabled: options.circuitBreaker?.enabled ?? true,
    };
  }

  public async runToAbsoluteSuccess(): Promise<AutoRunnerReport> {
    let turns = 0;
    let circuitBreakerStatus: "HEALTHY" | "TRIPPED" | "RECOVERED" = "HEALTHY";

    while (turns < this.maxTurns) {
      const currentCompletion = this.calculateCompletionPercentage();
      if (currentCompletion >= this.targetCompletion) {
        return this.buildReport(
          true,
          circuitBreakerStatus,
          `Absolute success achieved: 100% playbook completion (${this.stepsSucceeded} steps succeeded)`
        );
      }

      if (this.circuitBreaker.enabled) {
        if (Date.now() - this.startTime > this.circuitBreaker.timeoutMs) {
          return this.buildReport(false, "TRIPPED", "Circuit breaker tripped: Execution timeout exceeded");
        }
        if (this.totalCost >= this.circuitBreaker.maxCostDollars) {
          return this.buildReport(false, "TRIPPED", "Circuit breaker tripped: Maximum budget limit reached");
        }
        if (this.consecutiveFailures >= this.circuitBreaker.maxConsecutiveFailures) {
          return this.buildReport(
            false,
            "TRIPPED",
            "Circuit breaker tripped: Consecutive step failures exceeded retry cap"
          );
        }
      }

      turns += 1;
      const nextResult = selectNextAction(this.state, this.playbook);
      if (nextResult.status === "STOP_REASON") {
        if (nextResult.stopReason === "PLAYBOOK_COMPLETED") {
          const complete = this.calculateCompletionPercentage() >= this.targetCompletion;
          return this.buildReport(
            complete,
            circuitBreakerStatus,
            complete
              ? `Absolute success achieved: 100% playbook completion (${this.stepsSucceeded} steps succeeded)`
              : `Playbook execution finished at ${this.calculateCompletionPercentage().toFixed(1)}% completion`
          );
        }
        return this.buildReport(false, circuitBreakerStatus, `Auto runner stopped: ${nextResult.message}`);
      }

      const action = nextResult.action;
      if (!action) break;

      const approval = evaluateApprovalBoundary({
        policy: "FROM_PLAYBOOK",
        hasUserApproval: this.hasUserApproval,
        actionType: "EXECUTE",
      });
      if (!approval.allowed) {
        return this.buildReport(false, circuitBreakerStatus, `Auto runner paused: ${approval.reason}`);
      }

      console.log(`  ▶ [Turn ${turns}] Executing Step: ${action.stepId} ("${action.command}")...`);
      const attempt = await this.executeStepWithAutoresearch(action, turns);

      if (attempt.success) {
        console.log(`    ✔ Step ${action.stepId} SUCCEEDED [Executed & Verified]`);
        this.recordSuccess(action, attempt.changed);
        continue;
      }

      const failure = attempt.error ?? new Error(
        `Step ${action.stepId} execution failed verification or guard checks`
      );
      let repaired = false;
      if (this.onSelfHealingRepair) {
        this.repairsTriggered += 1;
        repaired = await this.onSelfHealingRepair(action.stepId, failure);
      }

      if (repaired && await this.verifyExecutedStep(action)) {
        console.log(`    ✔ Step ${action.stepId} SUCCEEDED [Repaired & Re-verified]`);
        circuitBreakerStatus = "RECOVERED";
        this.recordSuccess(action, attempt.changed);
        continue;
      }

      console.log(`    ✖ Step ${action.stepId} FAILED [No verified effect]`);
      this.stepsFailed += 1;
      this.rolledBackChanges += 1;
      this.consecutiveFailures += 1;
      this.totalCost += 0.01;
      this.markStepInState(action.stepId, "FAILED");
    }

    const finalCompletion = this.calculateCompletionPercentage();
    return this.buildReport(
      finalCompletion >= this.targetCompletion,
      circuitBreakerStatus,
      finalCompletion >= this.targetCompletion
        ? "100% completion reached"
        : `Auto runner finished ${turns} turns with ${finalCompletion.toFixed(1)}% completion`
    );
  }

  private recordSuccess(action: ActionSpec, changed: boolean): void {
    this.stepsSucceeded += 1;
    if (changed) this.keptChanges += 1;
    this.consecutiveFailures = 0;
    this.totalCost += 0.02;
    this.markStepInState(action.stepId, "SUCCEEDED");
  }

  private async executeStepWithAutoresearch(
    action: ActionSpec,
    currentTurn: number
  ): Promise<StepAttemptResult> {
    let receipt: StepExecutionReceipt | undefined;
    const execute = async (): Promise<string> => {
      if (!this.onExecuteStep) {
        throw new Error(`No real step executor configured for ${action.stepId}`);
      }
      receipt = await this.onExecuteStep(action);
      if (!receipt.executed) {
        throw new Error(`Step executor did not confirm execution for ${action.stepId}`);
      }
      return receipt.description;
    };

    if (this.enableAutoresearch) {
      const result = await executeAutoresearchStepLoop(
        {
          stepId: action.stepId,
          verifyCommand: this.verifyCommand ?? action.command,
          guardCommand: this.guardCommand,
          onModifyStep: execute,
          onRunShell: this.onRunShellCommand,
        },
        currentTurn
      );
      if (result.action === "ROLLBACK") {
        return {
          success: false,
          changed: receipt?.changed ?? false,
          error: new Error(result.changeDescription),
        };
      }
    } else {
      try {
        await execute();
      } catch (error) {
        return {
          success: false,
          changed: receipt?.changed ?? false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
      if (!await this.verifyShell(action)) {
        return {
          success: false,
          changed: receipt?.changed ?? false,
          error: new Error(`Verification failed for ${action.stepId}`),
        };
      }
    }

    if (!await this.verifyShadow(action)) {
      return {
        success: false,
        changed: receipt?.changed ?? false,
        error: new Error(`Independent shadow verification failed for ${action.stepId}`),
      };
    }

    return { success: true, changed: receipt?.changed ?? false };
  }

  private async verifyExecutedStep(action: ActionSpec): Promise<boolean> {
    return await this.verifyShell(action) && await this.verifyShadow(action);
  }

  private async verifyShell(action: ActionSpec): Promise<boolean> {
    if (!this.onRunShellCommand) return false;
    const result = await this.onRunShellCommand(this.verifyCommand ?? action.command);
    if (result.exitCode !== 0) return false;
    if (this.guardCommand) {
      const guard = await this.onRunShellCommand(this.guardCommand);
      if (guard.exitCode !== 0) return false;
    }
    return true;
  }

  private async verifyShadow(action: ActionSpec): Promise<boolean> {
    if (!this.enableShadowVerification) return true;
    if (!this.onShadowVerify) return false;
    const result = await this.onShadowVerify(action);
    return result.passed && result.score >= 80 && result.checks.length > 0;
  }

  private markStepInState(stepId: string, status: ExecutionStatus): void {
    if (this.state.stages.length === 0) {
      this.state.stages.push({
        id: "stage-auto-1",
        status: "IN_PROGRESS",
        steps: [],
      });
    }

    const stage = this.state.stages[0] as StageState;
    const existing = stage.steps.find((step) => step.id === stepId);
    if (existing) {
      existing.status = status;
    } else {
      stage.steps.push({ id: stepId, status });
    }

    const allSucceeded = stage.steps.every((step) => step.status === "SUCCEEDED");
    if (allSucceeded && stage.steps.length === this.playbook.steps.length) {
      stage.status = "SUCCEEDED";
    }
  }

  public calculateCompletionPercentage(): number {
    const totalSteps = this.playbook.steps.length;
    if (totalSteps === 0) return 0;

    const completed = new Set<string>();
    for (const stage of this.state.stages) {
      for (const step of stage.steps) {
        if (step.status === "SUCCEEDED") completed.add(step.id);
      }
    }
    return Math.min(100, (completed.size / totalSteps) * 100);
  }

  private buildReport(
    completed: boolean,
    circuitBreakerStatus: "HEALTHY" | "TRIPPED" | "RECOVERED",
    message: string
  ): AutoRunnerReport {
    return {
      completed,
      completionPercentage: this.calculateCompletionPercentage(),
      turnsExecuted: this.stepsSucceeded + this.stepsFailed,
      stepsSucceeded: this.stepsSucceeded,
      stepsFailed: this.stepsFailed,
      selfHealingRepairsTriggered: this.repairsTriggered,
      keptChangesCount: this.keptChanges,
      rolledBackChangesCount: this.rolledBackChanges,
      circuitBreakerStatus,
      estimatedCostDollars: Number(this.totalCost.toFixed(3)),
      finalState: this.state,
      message,
    };
  }
}

export async function runAutoPlaybookLoop(options: AutoRunnerOptions): Promise<AutoRunnerReport> {
  return await new AutoPlaybookRunner(options).runToAbsoluteSuccess();
}
