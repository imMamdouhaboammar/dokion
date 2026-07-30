export interface SkipRecord {
  stepId: string;
  actor: string;
  reason: string;
  timestamp: string;
  isRequired: boolean;
}

export interface SkipResult {
  accepted: boolean;
  record?: SkipRecord;
  message: string;
}

export function recordStepSkip(
  stepId: string,
  reason: string,
  actor: string,
  isRequired: boolean = false
): SkipResult {
  if (isRequired) {
    return {
      accepted: false,
      message: `Cannot skip step ${stepId}: step is required and mandatory in playbook`,
    };
  }

  const record: SkipRecord = {
    stepId,
    actor,
    reason,
    timestamp: new Date().toISOString(),
    isRequired,
  };

  return {
    accepted: true,
    record,
    message: `Step ${stepId} skipped by ${actor}. Reason: ${reason}`,
  };
}
