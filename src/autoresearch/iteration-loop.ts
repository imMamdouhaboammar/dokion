import type { AutoresearchIterationStepResult, SuccessPredicate } from "./types.ts";

export interface IterationLoopOptions {
  stepId: string;
  verifyCommand?: string | undefined;
  guardCommand?: string | undefined;
  predicate?: SuccessPredicate | undefined;
  onModifyStep?: (() => Promise<string>) | undefined;
  onRunShell?: ((command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>) | undefined;
  onGitCommit?: ((message: string) => Promise<boolean>) | undefined;
  onGitRollback?: (() => Promise<boolean>) | undefined;
}

export async function executeAutoresearchStepLoop(
  options: IterationLoopOptions,
  currentIteration: number
): Promise<AutoresearchIterationStepResult> {
  const startTime = Date.now();
  let changeDescription = `Targeted modification pass for step ${options.stepId}`;

  // 1. Modify: Apply modification
  if (options.onModifyStep) {
    try {
      changeDescription = await options.onModifyStep();
    } catch (err: any) {
      return {
        iteration: currentIteration,
        changeDescription: `Failed modification: ${err.message}`,
        verifyPassed: false,
        guardPassed: false,
        action: "ROLLBACK",
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 2. Verify: Run verification command / predicate
  let verifyPassed = true;
  const verifyCmd = options.verifyCommand ?? options.predicate?.command ?? "bun test";

  if (options.onRunShell) {
    const vResult = await options.onRunShell(verifyCmd);
    verifyPassed = vResult.exitCode === 0;
  }

  // 3. Guard: Run safety guard command
  let guardPassed = true;
  if (options.guardCommand && options.onRunShell) {
    const gResult = await options.onRunShell(options.guardCommand);
    guardPassed = gResult.exitCode === 0;
  }

  // 4. Keep or Rollback
  const keep = verifyPassed && guardPassed;
  let action: "KEEP" | "ROLLBACK" = "ROLLBACK";

  if (keep) {
    action = "KEEP";
    if (options.onGitCommit) {
      await options.onGitCommit(`autoresearch(${options.stepId}): ${changeDescription}`);
    }
  } else {
    action = "ROLLBACK";
    if (options.onGitRollback) {
      await options.onGitRollback();
    }
  }

  return {
    iteration: currentIteration,
    changeDescription,
    verifyPassed,
    guardPassed,
    action,
    durationMs: Date.now() - startTime,
  };
}
