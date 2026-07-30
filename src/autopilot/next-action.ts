import type { DokionState } from '../state/types';
import type { NextActionResult } from './types';

export interface PlaybookStep {
  id: string;
  stageId?: string;
  command: string;
  args?: string[];
  type?: 'VERIFY' | 'REPAIR' | 'ANALYSIS' | 'GATE';
  dependsOn?: string[];
  required?: boolean;
}

export interface MinimalPlaybook {
  id: string;
  name: string;
  steps: PlaybookStep[];
}

export function selectNextAction(
  state: DokionState | null,
  playbook: MinimalPlaybook | null
): NextActionResult {
  if (!playbook || !playbook.steps || playbook.steps.length === 0) {
    return {
      status: 'STOP_REASON',
      stopReason: 'NO_ACTIVE_PLAYBOOK',
      message: 'No active playbook loaded or playbook has no steps',
    };
  }

  const firstStep = playbook.steps[0];
  if (!firstStep) {
    return {
      status: 'STOP_REASON',
      stopReason: 'NO_ACTIVE_PLAYBOOK',
      message: 'Playbook steps array is empty',
    };
  }

  if (!state) {
    // Brand new run, start with first step
    return {
      status: 'ACTION_SELECTED',
      action: {
        id: `act-${firstStep.id}`,
        stepId: firstStep.id,
        stageId: firstStep.stageId ?? 'default',
        command: firstStep.command,
        type: firstStep.type ?? 'ANALYSIS',
      },
      revision: 0,
    };
  }

  const runStatus = state.run.status;

  if (runStatus === 'COMPLETED') {
    return {
      status: 'STOP_REASON',
      stopReason: 'PLAYBOOK_COMPLETED',
      message: 'All playbook steps have been executed and verified',
      revision: state.revision,
    };
  }

  if (runStatus === 'AWAITING_USER') {
    return {
      status: 'STOP_REASON',
      stopReason: 'AWAITING_APPROVAL',
      message: 'Pipeline is paused waiting for user approval',
      revision: state.revision,
    };
  }

  if (runStatus === 'FAILED' || runStatus === 'STOPPED' || runStatus === 'BLOCKED') {
    return {
      status: 'STOP_REASON',
      stopReason: 'FAILURE_STOP',
      message: `Pipeline stopped due to status ${runStatus}`,
      revision: state.revision,
    };
  }

  // Collect completed step IDs from stages
  const completedStepIds = new Set<string>();
  for (const stage of state.stages ?? []) {
    for (const stepState of stage.steps ?? []) {
      if (stepState.status === 'SUCCEEDED') {
        completedStepIds.add(stepState.id);
      }
    }
  }

  for (const step of playbook.steps) {
    if (completedStepIds.has(step.id)) {
      continue;
    }

    // Check dependencies
    const dependenciesMet = (step.dependsOn ?? []).every((depId) =>
      completedStepIds.has(depId)
    );

    if (!dependenciesMet) {
      return {
        status: 'STOP_REASON',
        stopReason: 'DEPENDENCY_BLOCKED',
        message: `Step ${step.id} is blocked waiting on unresolved dependencies`,
        revision: state.revision,
      };
    }

    return {
      status: 'ACTION_SELECTED',
      action: {
        id: `act-${step.id}`,
        stepId: step.id,
        stageId: step.stageId ?? 'default',
        command: step.command,
        type: step.type ?? 'VERIFY',
      },
      revision: state.revision,
    };
  }

  return {
    status: 'STOP_REASON',
    stopReason: 'PLAYBOOK_COMPLETED',
    message: 'All playbook steps have completed',
    revision: state.revision,
  };
}
