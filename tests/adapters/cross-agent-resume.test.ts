import { describe, test, expect } from "bun:test";
import { reconcileCrossAgentResume } from "../../src/platform/adapter-contract";

describe("PROD-008 Cross-Agent Handoff and Session Resume", () => {
  test("pauses session under Claude adapter and resumes under Codex adapter without state corruption", () => {
    const initialState = {
      runId: "run-999",
      lastAdapter: "claude-code",
      status: "PAUSED_FOR_APPROVAL",
      completedStepIds: ["step-1", "step-2"],
    };

    const resumeContext = {
      resumingAdapter: "codex",
      resumingUser: "mamdouh",
    };

    const resumedState = reconcileCrossAgentResume(initialState, resumeContext);
    expect(resumedState.status).toBe("RESUMED");
    expect(resumedState.activeAdapter).toBe("codex");
    expect(resumedState.completedStepIds).toEqual(["step-1", "step-2"]);
    expect(resumedState.handoffLog).toHaveLength(1);
  });
});
