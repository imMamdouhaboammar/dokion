import { describe, test, expect } from 'bun:test';
import { evaluateRetryEligibility } from '../../src/autopilot/retry-policy';

describe('CORE-004 Bounded Retry Scheduler', () => {
  test('rejects retry when step error is not retryable', () => {
    const decision = evaluateRetryEligibility({
      stepId: 's1',
      isRetryable: false,
      attempts: 1,
      maxAttempts: 3,
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain('not retryable');
  });

  test('schedules retry with exponential backoff when attempt < maxAttempts', () => {
    const decision = evaluateRetryEligibility({
      stepId: 's1',
      isRetryable: true,
      attempts: 1,
      maxAttempts: 3,
      baseDelayMs: 1000,
    });
    expect(decision.eligible).toBe(true);
    expect(decision.nextAttempt).toBe(2);
    expect(decision.delayMs).toBe(1000);
  });

  test('caps delay at maxDelayMs', () => {
    const decision = evaluateRetryEligibility({
      stepId: 's1',
      isRetryable: true,
      attempts: 10,
      maxAttempts: 15,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
    });
    expect(decision.eligible).toBe(true);
    expect(decision.delayMs).toBe(5000);
  });

  test('stops retries when maxAttempts is reached', () => {
    const decision = evaluateRetryEligibility({
      stepId: 's1',
      isRetryable: true,
      attempts: 3,
      maxAttempts: 3,
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reason).toContain('maximum retry limit');
  });
});
