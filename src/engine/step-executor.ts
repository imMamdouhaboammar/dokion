import type { DokionState, StepState } from '../state/types';

export interface StepOptions {
  stepId: string;
  command: string;
  args?: string[];
  dryRun?: boolean;
}

export interface StepExecutionResult {
  stepId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export async function executeGuardedStep(
  stepOptions: StepOptions,
  state: DokionState | null
): Promise<StepExecutionResult> {
  const { stepId, command, args = [], dryRun = false } = stepOptions;

  if (dryRun) {
    return {
      stepId,
      status: 'SUCCEEDED',
      exitCode: 0,
      stdout: `[DRY-RUN] Executed ${command} ${args.join(' ')}`,
    };
  }

  const child = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = child.stdout ? await new Response(child.stdout).text() : '';
  const stderr = child.stderr ? await new Response(child.stderr).text() : '';
  const exitCode = await child.exited;

  return {
    stepId,
    status: exitCode === 0 ? 'SUCCEEDED' : 'FAILED',
    exitCode,
    stdout,
    stderr,
  };
}
