import { describe, test, expect } from 'bun:test';
import { evaluateReadinessCriteria } from '../../src/evidence/readiness';
import type { DokionState } from '../../src/state/types';

describe('EVID-001 Qualification & Readiness Report', () => {
  test('returns isReady false when state is null', () => {
    const result = evaluateReadinessCriteria(null);
    expect(result.isReady).toBe(false);
    expect(result.score).toBe(0);
  });

  test('returns isReady true when state is COMPLETED without degradations', () => {
    const state: Partial<DokionState> = {
      run: {
        id: 'run-1',
        started_at: new Date().toISOString(),
        status: 'COMPLETED',
      },
    };
    const result = evaluateReadinessCriteria(state as DokionState);
    expect(result.isReady).toBe(true);
    expect(result.score).toBe(100);
  });
});
