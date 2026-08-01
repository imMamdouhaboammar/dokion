import { DokionError } from "../../core/errors.ts";
import { ExecutionEngine } from "../../engine/execution-engine.ts";
import { loadActivePlaybook } from "../../playbook/load-playbook.ts";
import type { DokionState, ExecutionStatus, StepState } from "../../state/types.ts";
import { writeCliDiagnostic, writeCliResult } from "../output.ts";
import type { CliOutputFormat } from "../types.ts";

export interface AutoRunnerCliOptions {
  options: Map<string, true | string>;
  flags: Set<string>;
  format: CliOutputFormat;
}

interface ProductionAutoRunnerReport {
  execution_engine: "production";
  runStatus: DokionState["run"]["status"];
  completed: boolean;
  completionPercentage: number;
  turnsExecuted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  keptChangesCount: number;
  rolledBackChangesCount: number;
  circuitBreakerStatus: "NOT_APPLICABLE";
  estimatedCostDollars: null;
  finalState: DokionState;
  message: string;
}

const SUCCESSFUL_STATUSES = new Set<ExecutionStatus>([
  "SUCCEEDED",
  "SKIPPED_INAPPLICABLE",
  "SKIPPED_BY_USER",
]);

const FAILED_STATUSES = new Set<ExecutionStatus>([
  "FAILED",
  "BLOCKED",
  "STOPPED_BY_POLICY",
]);

function isFixStep(step: StepState): boolean {
  return step.mode === "FIX_AUTOMATICALLY" || step.mode === "FIX_WITH_APPROVAL";
}

function summarizeProductionRun(state: DokionState): ProductionAutoRunnerReport {
  const steps = state.stages.flatMap((stage) => stage.steps);
  const completedSteps = steps.filter((step) => SUCCESSFUL_STATUSES.has(step.status));
  const succeeded = steps.filter((step) => step.status === "SUCCEEDED");
  const failed = steps.filter((step) => FAILED_STATUSES.has(step.status));
  const completed = state.run.status === "COMPLETED";
  const completionPercentage = steps.length === 0
    ? (completed ? 100 : 0)
    : (completedSteps.length / steps.length) * 100;
  const keptChanges = succeeded.filter(
    (step) => isFixStep(step) && (step.evidence?.length ?? 0) > 0
  ).length;
  const rejectedRepairs = failed.filter((step) => isFixStep(step)).length;

  return {
    execution_engine: "production",
    runStatus: state.run.status,
    completed,
    completionPercentage,
    turnsExecuted: steps.filter((step) => step.status !== "PENDING").length,
    stepsSucceeded: succeeded.length,
    stepsFailed: failed.length,
    keptChangesCount: keptChanges,
    rolledBackChangesCount: rejectedRepairs,
    circuitBreakerStatus: "NOT_APPLICABLE",
    estimatedCostDollars: null,
    finalState: state,
    message: completed
      ? `Production playbook execution completed with evidence for ${succeeded.length} succeeded steps`
      : `Production playbook execution stopped with run status ${state.run.status}`,
  };
}

function rejectLegacySimulationControls(invocation: AutoRunnerCliOptions): void {
  const controls = [
    ...Array.from(invocation.options.keys()).filter((option) => option !== "--format"),
    ...invocation.flags.values(),
  ];
  if (controls.length === 0) return;

  throw new DokionError(
    "UNSUPPORTED_EXECUTION",
    "Legacy simulated auto-runner controls are not supported by the production execution engine",
    { controls }
  );
}

export async function handleAutoRunnerCommand(
  root: string,
  invocation: AutoRunnerCliOptions
): Promise<void> {
  try {
    rejectLegacySimulationControls(invocation);
    const loaded = await loadActivePlaybook(root);
    const state = await new ExecutionEngine(root).run();
    const report = summarizeProductionRun(state);

    if (invocation.format === "human") {
      const totalSteps = loaded.data.stages.reduce(
        (total, stage) => total + stage.steps.length,
        0
      );
      console.log("\nDokion Auto Runner: production execution\n");
      console.log(`  Playbook Name:       ${loaded.data.project.name}`);
      console.log(`  Total Steps Loaded:  ${totalSteps}`);
      console.log(`  Completion Reached:  ${report.completionPercentage.toFixed(1)}%`);
      console.log(`  Steps Succeeded:     ${report.stepsSucceeded}`);
      console.log(`  Steps Failed:        ${report.stepsFailed}`);
      console.log(`  Verified Fixes:      ${report.keptChangesCount}`);
      console.log(`  Rejected Fixes:      ${report.rolledBackChangesCount}`);
      console.log(`  Run Status:          ${state.run.status}`);
      console.log(`  Status Message:      ${report.message}\n`);
    } else {
      writeCliResult(report, invocation.format);
    }

    if (!report.completed) process.exitCode = 1;
  } catch (error) {
    writeCliDiagnostic(
      error instanceof DokionError
        ? error
        : new DokionError(
            "COMMAND_FAILED",
            error instanceof Error ? error.message : String(error)
          ),
      invocation.format
    );
    process.exitCode = 1;
  }
}
