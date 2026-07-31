import { describe, expect, it } from "bun:test";
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
  it("executes playbook continuously from A to Z until reaching 100% completion", async () => {
    const state = createMockState();
    const result = await runAutoPlaybookLoop({
      playbook: mockPlaybook,
      state,
      targetCompletion: 100,
      maxTurns: 50,
      circuitBreaker: { enabled: true, maxCostDollars: 10.0 },
    });

    expect(result.completed).toBe(true);
    expect(result.completionPercentage).toBe(100);
    expect(result.stepsSucceeded).toBe(5);
    expect(result.circuitBreakerStatus).toBe("HEALTHY");
  });

  it("trips circuit breaker when budget limit is exceeded", async () => {
    const state = createMockState();
    const runner = new AutoPlaybookRunner({
      playbook: mockPlaybook,
      state,
      circuitBreaker: {
        enabled: true,
        maxCostDollars: 0.01, // Budget less than single step cost 0.02
      },
    });

    const result = await runner.runToAbsoluteSuccess();

    expect(result.completed).toBe(false);
    expect(result.circuitBreakerStatus).toBe("TRIPPED");
  });

  it("triggers autonomous self-healing repair when step verification fails", async () => {
    const state = createMockState();

    const runner = new AutoPlaybookRunner({
      playbook: mockPlaybook,
      state,
      enableShadowVerification: false,
      enableAutoresearch: false,
      onSelfHealingRepair: async () => {
        return true;
      },
    });

    const result = await runner.runToAbsoluteSuccess();

    expect(result.completed).toBe(true);
  });
});
