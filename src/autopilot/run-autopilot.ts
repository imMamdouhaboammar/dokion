import type { DokionState } from '../state/types';
import { selectNextAction, type MinimalPlaybook } from './next-action';
import { evaluateApprovalBoundary } from '../policy/approval-policy';
import { evaluateFailureTransition } from '../policy/failure-policy';
import { evaluateRetryEligibility } from './retry-policy';
import type { NextActionResult } from './types';

export interface AutopilotOptions {
  playbook: MinimalPlaybook;
  state: DokionState | null;
  dryRun?: boolean;
  maxTurns?: number;
  hasUserApproval?: boolean;
}

export interface AutopilotRunResult {
  completed: boolean;
  turnsExecuted: number;
  finalState: DokionState | null;
  lastAction?: NextActionResult;
  message: string;
}

export async function runAutopilot(options: AutopilotOptions): Promise<AutopilotRunResult> {
  const { playbook, dryRun = false, maxTurns = 50, hasUserApproval = true } = options;
  let currentState = options.state;
  let turnsExecuted = 0;
  let lastResult: NextActionResult | undefined;

  while (turnsExecuted < maxTurns) {
    turnsExecuted++;

    const nextResult = selectNextAction(currentState, playbook);
    lastResult = nextResult;

    if (nextResult.status === 'STOP_REASON') {
      return {
        completed: nextResult.stopReason === 'PLAYBOOK_COMPLETED',
        turnsExecuted,
        finalState: currentState,
        ...(nextResult ? { lastAction: nextResult } : {}),
        message: nextResult.message ?? `Stopped due to ${nextResult.stopReason}`,
      };
    }

    if (dryRun) {
      return {
        completed: false,
        turnsExecuted,
        finalState: currentState,
        ...(nextResult ? { lastAction: nextResult } : {}),
        message: `Dry-run mode: next action would be step ${nextResult.action?.stepId}`,
      };
    }

    // Check approval policy
    const approvalDecision = evaluateApprovalBoundary({
      policy: 'FROM_PLAYBOOK',
      hasUserApproval,
      actionType: 'EXECUTE',
    });

    if (!approvalDecision.allowed) {
      return {
        completed: false,
        turnsExecuted,
        finalState: currentState,
        ...(nextResult ? { lastAction: nextResult } : {}),
        message: `Autopilot paused: ${approvalDecision.reason}`,
      };
    }

    // Mark step as completed in state for mock/local loop simulation
    if (currentState && nextResult.action?.stepId) {
      const stepId = nextResult.action.stepId;
      const stage = currentState.stages[0];
      if (stage) {
        stage.steps.push({
          id: stepId,
          status: 'SUCCEEDED',
        });
      }
    }
  }

  return {
    completed: false,
    turnsExecuted,
    finalState: currentState,
    ...(lastResult ? { lastAction: lastResult } : {}),
    message: `Autopilot reached maximum turn limit (${maxTurns})`,
  };
}
