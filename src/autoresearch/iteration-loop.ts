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

function failureResult(
  currentIteration: number,
  startTime: number,
  changeDescription: string
): AutoresearchIterationStepResult {
  return {
    iteration: currentIteration,
    changeDescription,
    verifyPassed: false,
    guardPassed: false,
    action: "ROLLBACK",
    durationMs: Date.now() - startTime,
  };
}

export async function executeAutoresearchStepLoop(
  options: IterationLoopOptions,
  currentIteration: number
): Promise<AutoresearchIterationStepResult> {
  const startTime = Date.now();

  if (!options.onModifyStep) {
    return failureResult(
      currentIteration,
      startTime,
      `Failed modification: modify callback is required for step ${options.stepId}`
    );
  }

  let changeDescription: string;
  try {
    changeDescription = await options.onModifyStep();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return failureResult(currentIteration, startTime, `Failed modification: ${message}`);
  }

  if (!options.onRunShell) {
    await options.onGitRollback?.();
    return failureResult(
      currentIteration,
      startTime,
      `Failed verification: command runner is required for step ${options.stepId}`
    );
  }

  const verifyCommand = options.verifyCommand ?? options.predicate?.command ?? "bun test";
  const verification = await options.onRunShell(verifyCommand);
  const verifyPassed = verification.exitCode === 0;

  let guardPassed = true;
  if (options.guardCommand) {
    const guard = await options.onRunShell(options.guardCommand);
    guardPassed = guard.exitCode === 0;
  }

  if (!verifyPassed || !guardPassed) {
    await options.onGitRollback?.();
    return {
      iteration: currentIteration,
      changeDescription,
      verifyPassed,
      guardPassed,
      action: "ROLLBACK",
      durationMs: Date.now() - startTime,
    };
  }

  if (options.onGitCommit) {
    const committed = await options.onGitCommit(
      `autoresearch(${options.stepId}): ${changeDescription}`
    );
    if (!committed) {
      await options.onGitRollback?.();
      return {
        iteration: currentIteration,
        changeDescription: `Failed commit: commit callback did not confirm persistence for step ${options.stepId}`,
        verifyPassed: true,
        guardPassed: true,
        action: "ROLLBACK",
        durationMs: Date.now() - startTime,
      };
    }
  }

  return {
    iteration: currentIteration,
    changeDescription,
    verifyPassed: true,
    guardPassed: true,
    action: "KEEP",
    durationMs: Date.now() - startTime,
  };
}
