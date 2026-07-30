import type { DokionState } from '../state/types';
import { selectNextAction, type MinimalPlaybook } from './next-action';

export interface DecisionTraceStep {
  stepId?: string;
  actionType?: string;
  command?: string;
  status: string;
  reason?: string;
}

export interface DecisionTrace {
  playbookId: string;
  predictedTransitions: DecisionTraceStep[];
  isDeterministic: boolean;
}

export function generateDryRunTrace(
  state: DokionState | null,
  playbook: MinimalPlaybook
): DecisionTrace {
  const transitions: DecisionTraceStep[] = [];
  const nextResult = selectNextAction(state, playbook);

  if (nextResult.status === 'ACTION_SELECTED' && nextResult.action) {
    transitions.push({
      stepId: nextResult.action.stepId,
      actionType: nextResult.action.type,
      command: nextResult.action.command,
      status: 'PREDICTED_EXECUTION',
    });
  } else {
    const reason = nextResult.message ?? nextResult.stopReason;
    transitions.push({
      status: 'PREDICTED_STOP',
      ...(reason ? { reason } : {}),
    });
  }

  return {
    playbookId: playbook.id,
    predictedTransitions: transitions,
    isDeterministic: true,
  };
}
