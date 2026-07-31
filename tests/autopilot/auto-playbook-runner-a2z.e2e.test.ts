import { describe, expect, test } from "bun:test";
import { AutoPlaybookRunner } from "../../src/autopilot/auto-playbook-runner.ts";
import type { MinimalPlaybook } from "../../src/autopilot/next-action.ts";
import type { DokionState } from "../../src/state/types.ts";

describe("Auto Playbook Runner A-to-Z Execution", () => {
  test("runs playbook completely from A to Z to 100% completion", async () => {
    const samplePlaybook: MinimalPlaybook = {
      id: "test-playbook-a2z",
      name: "Test A-to-Z Playbook",
      steps: [
        { id: "step-1-1", command: "echo Scan root", type: "ANALYSIS" },
        { id: "step-1-2", command: "echo Check git", type: "ANALYSIS" },
        { id: "step-2-1", command: "echo Run typecheck", type: "VERIFY" },
        { id: "step-2-2", command: "echo Run test suite", type: "VERIFY" },
      ],
    };

    const initialState: DokionState = {
      schema_version: 1,
      revision: 1,
      playbook: {
        path: ".dokion/playbook.json",
        digest: "test-digest",
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
      run: { id: "test-run-1", status: "RUNNING", started_at: new Date().toISOString() },
      profile: {
        agent: "claude_code",
        detected_by: "environment",
        guarantees: { hook_enforcement: true, subagent_isolation: true, parallel_writes: true, worktree_isolation: true },
        degradations: [],
      },
      stages: [],
    };

    const runner = new AutoPlaybookRunner({
      playbook: samplePlaybook,
      state: initialState,
      targetCompletion: 100,
      maxTurns: 10,
      enableAutoresearch: true,
      enableShadowVerification: true,
      hasUserApproval: true,
    });

    const report = await runner.runToAbsoluteSuccess();

    expect(report.completed).toBe(true);
    expect(report.completionPercentage).toBe(100);
    expect(report.stepsSucceeded).toBe(4);
    expect(report.circuitBreakerStatus).toBe("HEALTHY");
    expect(report.message).toContain("100% playbook completion");
  });
});
