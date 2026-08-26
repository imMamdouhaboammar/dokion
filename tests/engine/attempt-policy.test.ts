import { describe, expect, test } from "bun:test";

import { nextExecutionAttempt } from "../../src/engine/attempt-policy.ts";

describe("runtime execution attempt policy", () => {
  test("starts the first pending attempt at one", () => {
    expect(nextExecutionAttempt({ status: "PENDING", attempts: 0 })).toBe(1);
  });

  test("increments a terminal failed step for an explicit retry", () => {
    expect(nextExecutionAttempt({ status: "FAILED", attempts: 1 })).toBe(2);
  });

  test("keeps the same attempt when resuming an interrupted in-progress step", () => {
    expect(nextExecutionAttempt({ status: "IN_PROGRESS", attempts: 1 })).toBe(1);
  });
});
