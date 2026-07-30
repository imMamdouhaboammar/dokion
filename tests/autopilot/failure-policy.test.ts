import { describe, test, expect } from 'bun:test';
import { evaluateFailureTransition } from '../../src/policy/failure-policy';

describe('CORE-003 Failure Policy Transitions', () => {
  test('returns RETRY when attempt < maxAttempts', () => {
    const result = evaluateFailureTransition({
      policy: 'STOP_PIPELINE',
      stepId: 'step-1',
      error: 'Command exit 1',
      attempts: 1,
      maxAttempts: 3,
    });
    expect(result.action).toBe('RETRY');
    expect(result.nextRunStatus).toBe('RUNNING');
  });

  test('returns STOP_PIPELINE when attempts exhausted', () => {
    const result = evaluateFailureTransition({
      policy: 'STOP_PIPELINE',
      stepId: 'step-1',
      error: 'Command exit 1',
      attempts: 3,
      maxAttempts: 3,
    });
    expect(result.action).toBe('STOP');
    expect(result.nextRunStatus).toBe('FAILED');
    expect(result.nextStepStatus).toBe('FAILED');
  });

  test('returns CONTINUE when policy is CONTINUE', () => {
    const result = evaluateFailureTransition({
      policy: 'CONTINUE',
      stepId: 'step-1',
      error: 'Linter warning',
      attempts: 1,
      maxAttempts: 1,
    });
    expect(result.action).toBe('CONTINUE');
    expect(result.nextRunStatus).toBe('RUNNING');
  });

  test('returns REQUEST_USER_DECISION when policy requests user decision', () => {
    const result = evaluateFailureTransition({
      policy: 'REQUEST_USER_DECISION',
      stepId: 'step-1',
      error: 'Build error',
      attempts: 1,
      maxAttempts: 1,
    });
    expect(result.action).toBe('AWAIT_USER');
    expect(result.nextRunStatus).toBe('AWAITING_USER');
  });
});
