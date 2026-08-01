import { createInitialState, classifyGoal } from "../../autoresearch/orchestrator.ts";
import { DokionError } from "../../core/errors.ts";
import { writeCliResult } from "../output.ts";
import type { CliOutputFormat } from "../types.ts";

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
  const isDryRun = invocation.dryRun === true || invocation.flags.has("dry-run");

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

  throw new DokionError(
    "UNSUPPORTED_EXECUTION",
    "Autoresearch non-dry mode requires production execution callbacks and is not available yet",
    {
      root,
      goal,
      predicate: initialState.predicate.command,
      next: "Use dokion autoresearch --dry-run to inspect the plan, then execute an approved playbook through dokion run or dokion auto-runner."
    }
  );
}
