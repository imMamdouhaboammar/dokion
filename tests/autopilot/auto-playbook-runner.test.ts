import { describe, expect, it, mock } from "bun:test";
import { runAutoPlaybookLoop, AutoPlaybookRunner } from "../../src/autopilot/auto-playbook-runner.ts";
import type { MinimalPlaybook } from "../../src/autopilot/next-action.ts";
import type { DokionState } from "../../src/state/types.ts";

const mockPlaybook: MinimalPlaybook = {
  id: "pb-mock-1",
  name: "Mock Playbook",
  steps: [
    { id: "step-1", stageId: "stage-1", command: "check-1" },
    { id: "step-2", stageId: "stage-1", command: "check-2", dependsOn: ["step-1"] },
    { id: "step-3", stageId: "stage-1", command: "check-3", dependsOn: ["step-2"] },
    { id: "step-4", stageId: "stage-2", command: "check-4", dependsOn: ["step-3"] },
    { id: "step-5", stageId: "stage-2", command: "check-5", dependsOn: ["step-4"] },
  ],
};

function createMockState(): DokionState {
  return {
    schema_version: 1,
    revision: 1,
    playbook: {
      path: ".dokion/playbook.json",
      digest: "digest-123",
      verified_at: new Date().toISOString(),
    },
    repository_identity: {
      schema_version: 1,
      kind: "git",
      canonical_root: "/tmp",
      root_digest: "digest-1",
      worktree_id: "wt-1",
      playbook_digest: "pb-1",
      captured_at: new Date().toISOString(),
    },
    run: {
      id: "run-mock-123",
      started_at: new Date().toISOString(),
      status: "RUNNING",
    },
    profile: {
      agent: "claude_code",
      detected_by: "environment",
      guarantees: { hook_enforcement: true, subagent_isolation: true, parallel_writes: true, worktree_isolation: true },
      degradations: [],
    },
    stages: [],
  };
}

describe("AUTORUN-001 Auto Playbook Runner Loop", () => {
  it("fails closed when no real step executor is configured", async () => {
    const result = await runAutoPlaybookLoop({
      playbook: mockPlaybook,
      state: createMockState(),
      targetCompletion: 100,
      maxTurns: 1,
      enableShadowVerification: false,
      onRunShellCommand: async () => ({ exitCode: 0, stdout: "PASS", stderr: "" }),
    });

    expect(result.completed).toBe(false);
    expect(result.completionPercentage).toBe(0);
    expect(result.stepsSucceeded).toBe(0);
    expect(result.stepsFailed).toBe(1);
    expect(result.keptChangesCount).toBe(0);
  });

  it("executes and verifies every step before reporting 100% completion", async () => {
    const executed: string[] = [];
    const verified: string[] = [];

    const result = await runAutoPlaybookLoop({
      playbook: mockPlaybook,
      state: createMockState(),
      targetCompletion: 100,
      maxTurns: 50,
      enableShadowVerification: false,
      circuitBreaker: { enabled: true, maxCostDollars: 10.0 },
      onExecuteStep: async (action) => {
        executed.push(action.stepId);
        return {
          executed: true,
          changed: true,
          description: `Applied ${action.stepId}`,
        };
      },
      onRunShellCommand: async (command) => {
        verified.push(command);
        return { exitCode: 0, stdout: "PASS", stderr: "" };
      },
    });

    expect(result.completed).toBe(true);
    expect(result.completionPercentage).toBe(100);
    expect(result.stepsSucceeded).toBe(5);
    expect(result.keptChangesCount).toBe(5);
    expect(result.circuitBreakerStatus).toBe("HEALTHY");
    expect(executed).toEqual(["step-1", "step-2", "step-3", "step-4", "step-5"]);
    expect(verified).toEqual(["check-1", "check-2", "check-3", "check-4", "check-5"]);
  });

  it("does not treat hard-coded shadow checks as verification", async () => {
    const result = await runAutoPlaybookLoop({
      playbook: { ...mockPlaybook, steps: [mockPlaybook.steps[0]!] },
      state: createMockState(),
      maxTurns: 1,
      enableShadowVerification: true,
      onExecuteStep: async () => ({ executed: true, changed: false, description: "Analyzed project" }),
      onRunShellCommand: async () => ({ exitCode: 0, stdout: "PASS", stderr: "" }),
    });

    expect(result.completed).toBe(false);
    expect(result.stepsSucceeded).toBe(0);
    expect(result.stepsFailed).toBe(1);
  });

  it("trips circuit breaker when budget limit is exceeded", async () => {
    const runner = new AutoPlaybookRunner({
      playbook: mockPlaybook,
      state: createMockState(),
      enableShadowVerification: false,
      onExecuteStep: async () => ({ executed: true, changed: false, description: "Analyzed project" }),
      onRunShellCommand: async () => ({ exitCode: 0, stdout: "PASS", stderr: "" }),
      circuitBreaker: {
        enabled: true,
        maxCostDollars: 0.01,
      },
    });

    const result = await runner.runToAbsoluteSuccess();

    expect(result.completed).toBe(false);
    expect(result.circuitBreakerStatus).toBe("TRIPPED");
  });

  it("only reports self-healing after the repaired step passes verification", async () => {
    const repair = mock(async () => true);
    let verificationAttempts = 0;

    const runner = new AutoPlaybookRunner({
      playbook: { ...mockPlaybook, steps: [mockPlaybook.steps[0]!] },
      state: createMockState(),
      enableShadowVerification: false,
      onExecuteStep: async () => ({ executed: true, changed: true, description: "Applied candidate change" }),
      onRunShellCommand: async () => {
        verificationAttempts += 1;
        return verificationAttempts === 1
          ? { exitCode: 1, stdout: "", stderr: "FAIL" }
          : { exitCode: 0, stdout: "PASS", stderr: "" };
      },
      onSelfHealingRepair: repair,
    });

    const result = await runner.runToAbsoluteSuccess();

    expect(result.completed).toBe(true);
    expect(repair).toHaveBeenCalledTimes(1);
    expect(verificationAttempts).toBe(2);
    expect(result.selfHealingRepairsTriggered).toBe(1);
    expect(result.stepsSucceeded).toBe(1);
  });
});
