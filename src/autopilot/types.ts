import type { DokionState } from '../state/types';

export type ActionStatus = 'ACTION_SELECTED' | 'STOP_REASON';

export type StopReason =
  | 'NO_ACTIVE_PLAYBOOK'
  | 'PLAYBOOK_COMPLETED'
  | 'AWAITING_APPROVAL'
  | 'FAILURE_STOP'
  | 'BUDGET_EXCEEDED'
  | 'STALE_RUN'
  | 'RUN_LOCKED'
  | 'DEPENDENCY_BLOCKED';

export interface ActionSpec {
  id: string;
  stepId: string;
  stageId: string;
  command: string;
  args?: string[];
  type: 'VERIFY' | 'REPAIR' | 'ANALYSIS' | 'GATE';
  writeScope?: string[];
}

export interface NextActionResult {
  status: ActionStatus;
  action?: ActionSpec;
  stopReason?: StopReason;
  message?: string;
  revision?: number;
}
