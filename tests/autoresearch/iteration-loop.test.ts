import { describe, expect, test } from "bun:test";
import { executeAutoresearchStepLoop } from "../../src/autoresearch/iteration-loop.ts";

describe("Autoresearch Iteration Loop", () => {
  test("keeps changes when verify and guard pass", async () => {
    let committed = false;
    let rolledBack = false;

    const result = await executeAutoresearchStepLoop(
      {
        stepId: "test-step-1",
        onModifyStep: async () => "Optimized test function",
        onRunShell: async () => ({ exitCode: 0, stdout: "PASS", stderr: "" }),
        onGitCommit: async () => {
          committed = true;
          return true;
        },
        onGitRollback: async () => {
          rolledBack = true;
          return true;
        },
      },
      1
    );

    expect(result.action).toBe("KEEP");
    expect(result.verifyPassed).toBe(true);
    expect(result.guardPassed).toBe(true);
    expect(committed).toBe(true);
    expect(rolledBack).toBe(false);
  });

  test("rolls back changes when verify fails", async () => {
    let committed = false;
    let rolledBack = false;

    const result = await executeAutoresearchStepLoop(
      {
        stepId: "test-step-2",
        onModifyStep: async () => "Introduced breaking edit",
        onRunShell: async () => ({ exitCode: 1, stdout: "", stderr: "FAIL" }),
        onGitCommit: async () => {
          committed = true;
          return true;
        },
        onGitRollback: async () => {
          rolledBack = true;
          return true;
        },
      },
      1
    );

    expect(result.action).toBe("ROLLBACK");
    expect(result.verifyPassed).toBe(false);
    expect(committed).toBe(false);
    expect(rolledBack).toBe(true);
  });
});
