import type { DokionState } from '../state/types';

export interface ReadinessEvaluation {
  isReady: boolean;
  score: number;
  evaluatedAt: string;
  summary: string;
  gaps: string[];
}

export function evaluateReadinessCriteria(state: DokionState | null): ReadinessEvaluation {
  if (!state) {
    return {
      isReady: false,
      score: 0,
      evaluatedAt: new Date().toISOString(),
      summary: 'No state loaded; repository readiness unverified',
      gaps: ['Missing state.json machine record'],
    };
  }

  const gaps: string[] = [];

  if (state.run.status !== 'COMPLETED') {
    gaps.push(`Run status is ${state.run.status} instead of COMPLETED`);
  }

  if (state.run.degradations && state.run.degradations.length > 0) {
    gaps.push(`Active platform degradations recorded: ${state.run.degradations.join(', ')}`);
  }

  const isReady = gaps.length === 0;
  const score = isReady ? 100 : Math.max(0, 100 - gaps.length * 25);

  return {
    isReady,
    score,
    evaluatedAt: new Date().toISOString(),
    summary: isReady
      ? 'Repository meets all configured production hardening criteria'
      : 'Repository has active gaps preventing production promotion',
    gaps,
  };
}
