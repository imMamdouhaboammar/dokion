import type { CliOutputFormat } from "../types.ts";
import { runAutoPlaybookLoop, type AutoRunnerReport } from "../../autopilot/auto-playbook-runner.ts";
import { loadActivePlaybook } from "../../playbook/load-playbook.ts";
import type { MinimalPlaybook } from "../../autopilot/next-action.ts";
import { StateStore } from "../../state/state-store.ts";
import { DokionError } from "../../core/errors.ts";
import { writeCliDiagnostic, writeCliResult } from "../output.ts";

export interface AutoRunnerCliOptions {
  options: Map<string, true | string>;
  flags: Set<string>;
  format: CliOutputFormat;
}

export async function handleAutoRunnerCommand(
  root: string,
  invocation: AutoRunnerCliOptions
): Promise<void> {
  let activePlaybook: MinimalPlaybook;
  try {
    const loaded = await loadActivePlaybook(root);
    const dokionPlaybook = loaded.data;
    const steps = (dokionPlaybook.stages ?? []).flatMap((stage) =>
      (stage.steps ?? []).map((step) => {
        const cmd =
          step.verification?.[0] ||
          step.permissions?.shell?.[0] ||
          `echo "Executing step ${step.id}"`;
        return {
          id: step.id,
          stageId: stage.id,
          command: cmd,
          type: "VERIFY" as const,
        };
      })
    );

    activePlaybook = {
      id: dokionPlaybook.project?.name || "active-playbook",
      name: dokionPlaybook.project?.name || "Active Playbook",
      steps,
    };
  } catch (err: any) {
    writeCliDiagnostic(
      err instanceof DokionError ? err : new DokionError("NO_ACTIVE_PLAYBOOK", err?.message || "No active playbook found."),
      invocation.format
    );
    process.exitCode = 1;
    return;
  }

  const store = new StateStore(root);
  let state = (await store.exists()) ? await store.load() : await store.initialize({ playbookDigest: "unconfigured", stages: [] });
  state.run.status = "RUNNING";

  const maxTurnsStr = invocation.options.get("--max-turns");
  const maxTurns = typeof maxTurnsStr === "string" ? parseInt(maxTurnsStr, 10) : 100;

  const targetStr = invocation.options.get("--target");
  const targetCompletion = typeof targetStr === "string" ? parseInt(targetStr, 10) : 100;

  const maxCostStr = invocation.options.get("--max-cost");
  const maxCost = typeof maxCostStr === "string" ? parseFloat(maxCostStr) : 5.0;

  const disableCircuitBreaker = invocation.flags.has("disable-circuit-breaker");

  const report: AutoRunnerReport = await runAutoPlaybookLoop({
    playbook: activePlaybook,
    state,
    maxTurns,
    targetCompletion,
    enableAutoresearch: true,
    circuitBreaker: {
      enabled: !disableCircuitBreaker,
      maxCostDollars: maxCost,
    },
    hasUserApproval: true,
    onRunShellCommand: async (command: string) => {
      try {
        const proc = Bun.spawn(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" });
        const stdoutPromise = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve("");
        const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve("");
        const exitCode = await proc.exited;
        const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
        return { exitCode, stdout, stderr };
      } catch (e: any) {
        return { exitCode: 1, stdout: "", stderr: e?.message || "Execution error" };
      }
    },
  });

  // Save final state
  await store.update(state.revision, () => report.finalState);

  if (invocation.format === "human") {
    console.log(`\n🤖 Dokion Auto Playbook Runner (Optimization Architect & Autoresearch Engine)\n`);
    console.log(`  Playbook Name:        ${activePlaybook.name}`);
    console.log(`  Total Steps Loaded:   ${activePlaybook.steps.length}`);
    console.log(`  Completion Target:    ${targetCompletion}%`);
    console.log(`  Completion Reached:   ${report.completionPercentage.toFixed(1)}%`);
    console.log(`  Turns Executed:       ${report.turnsExecuted}`);
    console.log(`  Steps Succeeded:      ${report.stepsSucceeded}`);
    console.log(`  Steps Failed:         ${report.stepsFailed}`);
    console.log(`  Kept Changes:         ${report.keptChangesCount}`);
    console.log(`  Rolled Back Changes:  ${report.rolledBackChangesCount}`);
    console.log(`  Self-Healing Repairs: ${report.selfHealingRepairsTriggered}`);
    console.log(`  Circuit Breaker:      ${report.circuitBreakerStatus}`);
    console.log(`  Estimated Cost:       $${report.estimatedCostDollars}`);
    console.log(`  Status Message:       ${report.message}\n`);
  } else {
    writeCliResult(report, invocation.format);
  }

  if (!report.completed) {
    process.exitCode = 1;
  }
}
