export interface RetryContext {
  stepId: string;
  isRetryable: boolean;
  attempts: number;
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface RetryDecision {
  eligible: boolean;
  nextAttempt: number;
  delayMs: number;
  reason: string;
}

export function evaluateRetryEligibility(context: RetryContext): RetryDecision {
  const {
    stepId,
    isRetryable,
    attempts,
    maxAttempts,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
  } = context;

  if (!isRetryable) {
    return {
      eligible: false,
      nextAttempt: attempts,
      delayMs: 0,
      reason: `Step ${stepId} error is not retryable`,
    };
  }

  if (attempts >= maxAttempts) {
    return {
      eligible: false,
      nextAttempt: attempts,
      delayMs: 0,
      reason: `Step ${stepId} reached maximum retry limit (${attempts}/${maxAttempts})`,
    };
  }

  const nextAttempt = attempts + 1;
  const calculatedDelay = Math.min(baseDelayMs * Math.pow(2, attempts - 1), maxDelayMs);

  return {
    eligible: true,
    nextAttempt,
    delayMs: calculatedDelay,
    reason: `Retry ${nextAttempt}/${maxAttempts} scheduled after ${calculatedDelay}ms`,
  };
}
