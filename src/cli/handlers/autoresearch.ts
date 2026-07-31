import type { CliOutputFormat } from "../types.ts";
import { createInitialState, classifyGoal } from "../../autoresearch/orchestrator.ts";
import { executeAutoresearchStepLoop } from "../../autoresearch/iteration-loop.ts";
import { writeCliResult } from "../output.ts";

export interface AutoresearchCliOptions {
  positionals: string[];
  options: Map<string, true | string>;
  flags: Set<string>;
  dryRun?: boolean;
  format: CliOutputFormat;
}

export async function handleAutoresearchCommand(
  root: string,
  invocation: AutoresearchCliOptions
): Promise<void> {
  const goal = invocation.positionals.slice(1).join(" ") || "Harden codebase and optimize test suite";
  const maxCyclesStr = invocation.options.get("--max-cycles");
  const maxCycles = typeof maxCyclesStr === "string" ? parseInt(maxCyclesStr, 10) : 50;
  const isDryRun = invocation.flags.has("dry-run");

  const initialState = createInitialState(goal, maxCycles);

  if (isDryRun) {
    const dryRunResult = {
      mode: "dry-run",
      goal,
      archetype: initialState.archetype,
      predicate: initialState.predicate,
      defaultPipeline: classifyGoal(goal).defaultPipeline,
      maxCycles,
    };

    if (invocation.format === "human") {
      console.log(`\n🔍 [autoresearch] Dry-Run Plan`);
      console.log(`  Goal:        ${goal}`);
      console.log(`  Archetype:   ${initialState.archetype}`);
      console.log(`  Predicate:   ${initialState.predicate.command}`);
      console.log(`  Pipeline:    ${classifyGoal(goal).defaultPipeline.join(" -> ")}\n`);
    } else {
      writeCliResult(dryRunResult, invocation.format);
    }
    return;
  }

  // Execute single orchestrator iteration pass
  const stepResult = await executeAutoresearchStepLoop(
    {
      stepId: "autoresearch-pass",
      verifyCommand: initialState.predicate.command,
    },
    1
  );

  const report = {
    goal,
    archetype: initialState.archetype,
    status: stepResult.action === "KEEP" ? "CONVERGED" : "PLATEAU",
    iterationResult: stepResult,
    completionPercentage: stepResult.action === "KEEP" ? 100 : 50,
  };

  if (invocation.format === "human") {
    console.log(`\n🤖 Dokion Autoresearch Orchestrator\n`);
    console.log(`  Goal:        ${goal}`);
    console.log(`  Archetype:   ${initialState.archetype}`);
    console.log(`  Verify Cmd:  ${initialState.predicate.command}`);
    console.log(`  Verify Pass: ${stepResult.verifyPassed ? "YES" : "NO"}`);
    console.log(`  Guard Pass:  ${stepResult.guardPassed ? "YES" : "NO"}`);
    console.log(`  Action:      ${stepResult.action}`);
    console.log(`  Duration:    ${stepResult.durationMs}ms\n`);
  } else {
    writeCliResult(report, invocation.format);
  }
}
