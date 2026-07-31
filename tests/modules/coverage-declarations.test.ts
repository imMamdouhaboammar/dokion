import { describe, test, expect } from "bun:test";
import { evaluateCoverageGaps } from "../../src/readiness/coverage";

describe("MOD-010 AI & Mobile Coverage Gap Modeling", () => {
  test("caps readiness score and flags unassigned gaps for AI agent safety and Mobile security", () => {
    const coverageDeclarations = [
      {
        lane: "ai-agent-safety",
        assignedModule: null,
        rationale: "No LLM guardrails module attached yet",
      },
      {
        lane: "mobile-native-security",
        assignedModule: null,
        rationale: "Mobile app build not part of core web release",
      },
      {
        lane: "app-sec",
        assignedModule: "modules/application-security/sast.json",
        rationale: "Active SAST module",
      },
    ];

    const result = evaluateCoverageGaps(coverageDeclarations);
    expect(result.hasUnassignedGaps).toBe(true);
    expect(result.unassignedLanes).toContain("ai-agent-safety");
    expect(result.unassignedLanes).toContain("mobile-native-security");
    expect(result.readinessScoreCap).toBeLessThanOrEqual(85);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  test("allows full readiness score when all coverage lanes have assigned modules", () => {
    const coverageDeclarations = [
      {
        lane: "ai-agent-safety",
        assignedModule: "modules/ai-safety/llm-guard.json",
        rationale: "LLM guard active",
      },
      {
        lane: "mobile-native-security",
        assignedModule: "modules/mobile/binary-scan.json",
        rationale: "Mobile binary scanner active",
      },
      {
        lane: "app-sec",
        assignedModule: "modules/application-security/sast.json",
        rationale: "Active SAST module",
      },
    ];

    const result = evaluateCoverageGaps(coverageDeclarations);
    expect(result.hasUnassignedGaps).toBe(false);
    expect(result.readinessScoreCap).toBe(100);
    expect(result.warnings.length).toBe(0);
  });
});
