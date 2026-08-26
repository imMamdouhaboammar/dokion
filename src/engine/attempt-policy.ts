import { DokionError } from "../core/errors.ts";

export interface ExecutionAttemptState {
  status: string;
  attempts?: number;
}

export function nextExecutionAttempt(state: ExecutionAttemptState): number {
  const attempts = state.attempts ?? 0;
  if (!Number.isSafeInteger(attempts) || attempts < 0) {
    throw new DokionError("INVALID_STATE", "Step attempt count must be a non-negative safe integer.", {
      status: state.status,
      attempts
    });
  }

  if (state.status === "IN_PROGRESS" || state.status === "AWAITING_APPROVAL") {
    if (attempts < 1) {
      throw new DokionError("INVALID_STATE", "An active step must already have an execution attempt.", {
        status: state.status,
        attempts
      });
    }
    return attempts;
  }

  return attempts + 1;
}
