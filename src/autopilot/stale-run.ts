import type { DokionState } from '../state/types';

export interface SystemContext {
  currentCommit?: string;
  playbookDigest?: string;
  capabilityLockDigest?: string;
}

export interface StaleRunClassification {
  isStale: boolean;
  reasons: string[];
}

export function classifyStaleRun(
  state: DokionState | null,
  context: SystemContext
): StaleRunClassification {
  if (!state) {
    return { isStale: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (
    context.currentCommit &&
    state.repository_identity.commit &&
    context.currentCommit !== state.repository_identity.commit
  ) {
    reasons.push(
      `Commit SHA drift: state commit ${state.repository_identity.commit} != current commit ${context.currentCommit}`
    );
  }

  if (
    context.playbookDigest &&
    state.playbook.digest &&
    context.playbookDigest !== state.playbook.digest
  ) {
    reasons.push(
      `Playbook digest changed: expected ${state.playbook.digest}, observed ${context.playbookDigest}`
    );
  }

  return {
    isStale: reasons.length > 0,
    reasons,
  };
}
