import { executeGuardedStep, type StepOptions, type StepExecutionResult } from '../../engine/step-executor';
import type { DokionState } from '../../state/types';

export async function handleStepCommand(
  options: StepOptions,
  state: DokionState | null
): Promise<StepExecutionResult> {
  return await executeGuardedStep(options, state);
}
