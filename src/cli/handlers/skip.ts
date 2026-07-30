import { recordStepSkip, type SkipResult } from '../../approvals/skip-store';

export function handleSkipCommand(
  stepId: string,
  reason: string,
  actor: string,
  isRequired: boolean = false
): SkipResult {
  return recordStepSkip(stepId, reason, actor, isRequired);
}
