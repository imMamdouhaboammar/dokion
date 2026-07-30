import type { RunStatus, ExecutionStatus } from '../state/types';

export type FailurePolicyEnum =
  | 'STOP_PIPELINE'
  | 'STOP_STAGE'
  | 'CONTINUE'
  | 'REQUEST_USER_DECISION'
  | 'MARK_BLOCKED';

export interface FailureContext {
  policy: FailurePolicyEnum;
  stepId: string;
  error: string;
  attempts?: number;
  maxAttempts?: number;
}

export interface FailureTransitionResult {
  nextRunStatus: RunStatus;
  nextStepStatus: ExecutionStatus;
  action: 'STOP' | 'CONTINUE' | 'AWAIT_USER' | 'BLOCK' | 'RETRY';
  message: string;
}

export function evaluateFailureTransition(context: FailureContext): FailureTransitionResult {
  const { policy, stepId, error, attempts = 1, maxAttempts = 1 } = context;

  if (attempts < maxAttempts) {
    return {
      nextRunStatus: 'RUNNING',
      nextStepStatus: 'IN_PROGRESS',
      action: 'RETRY',
      message: `Step ${stepId} failed (attempt ${attempts}/${maxAttempts}). Scheduling retry. Error: ${error}`,
    };
  }

  switch (policy) {
    case 'STOP_PIPELINE':
      return {
        nextRunStatus: 'FAILED',
        nextStepStatus: 'FAILED',
        action: 'STOP',
        message: `Pipeline stopped by policy STOP_PIPELINE on step ${stepId}. Error: ${error}`,
      };

    case 'STOP_STAGE':
      return {
        nextRunStatus: 'STOPPED',
        nextStepStatus: 'FAILED',
        action: 'STOP',
        message: `Stage stopped by policy STOP_STAGE on step ${stepId}. Error: ${error}`,
      };

    case 'CONTINUE':
      return {
        nextRunStatus: 'RUNNING',
        nextStepStatus: 'FAILED',
        action: 'CONTINUE',
        message: `Step ${stepId} failed but policy CONTINUE allows pipeline to proceed. Error: ${error}`,
      };

    case 'REQUEST_USER_DECISION':
      return {
        nextRunStatus: 'AWAITING_USER',
        nextStepStatus: 'AWAITING_APPROVAL',
        action: 'AWAIT_USER',
        message: `Step ${stepId} failed. Pausing pipeline for user decision (REQUEST_USER_DECISION). Error: ${error}`,
      };

    case 'MARK_BLOCKED':
      return {
        nextRunStatus: 'BLOCKED',
        nextStepStatus: 'BLOCKED',
        action: 'BLOCK',
        message: `Step ${stepId} marked as BLOCKED by policy. Error: ${error}`,
      };

    default:
      return {
        nextRunStatus: 'FAILED',
        nextStepStatus: 'FAILED',
        action: 'STOP',
        message: `Unknown failure policy for step ${stepId}. Stopping pipeline. Error: ${error}`,
      };
  }
}
