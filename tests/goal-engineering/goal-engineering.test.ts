import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoalAuditEngine } from "../../src/goal-engineering/audit.ts";
import { GoalBudgetTracker } from "../../src/goal-engineering/budget.ts";
import { GoalPatterns } from "../../src/goal-engineering/patterns.ts";
import { GoalStateEngine } from "../../src/goal-engineering/state.ts";
import { GoalStateSync } from "../../src/goal-engineering/sync.ts";
import { handleGoalCommand } from "../../src/cli/handlers/goal.ts";

describe("Goal Engineering Integration Suite", () => {
  const root = process.cwd();
  const testTmpDir = join(root, ".dokion-test-goal-tmp");

  beforeEach(() => {
    if (existsSync(testTmpDir)) rmSync(testTmpDir, { recursive: true, force: true });
    mkdirSync(testTmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testTmpDir)) rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("GoalAuditEngine audits local repository goal readiness", () => {
    const report = GoalAuditEngine.audit(root);
    expect(report.readinessScore).toBeGreaterThanOrEqual(0);
    expect(report.readinessScore).toBeLessThanOrEqual(100);
    expect(report.items.length).toBe(5);
    expect(["GOAL_READY", "NEEDS_HARNESS", "UNPREPARED"]).toContain(report.grade);
  });

  test("GoalBudgetTracker returns correct estimates for levels G1-G5", () => {
    const g1 = GoalBudgetTracker.getEstimate("G1");
    expect(g1.level).toBe("G1");
    expect(g1.maxTurns).toBe(3);

    const g3 = GoalBudgetTracker.getEstimate("G3");
    expect(g3.level).toBe("G3");
    expect(g3.estimatedTokens).toBe(60_000);

    const g5 = GoalBudgetTracker.getEstimate("G5");
    expect(g5.level).toBe("G5");
    expect(g5.maxTurns).toBe(50);

    const costSample = GoalBudgetTracker.estimateCost(50_000, 10_000);
    expect(costSample.totalTokens).toBe(60_000);
    expect(costSample.estimatedCostUSD).toBeGreaterThan(0);
  });

  test("GoalPatterns returns valid templates for standard patterns", () => {
    const patterns = GoalPatterns.listPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(6);

    const testsGreen = GoalPatterns.getPattern("tests-green");
    expect(testsGreen).toBeDefined();
    expect(testsGreen!.id).toBe("tests-green");
    expect(testsGreen!.goalMdTemplate).toContain("# GOAL: Make All Tests Pass");

    const fixBug = GoalPatterns.getPattern("fix-bug");
    expect(fixBug).toBeDefined();
    expect(fixBug!.id).toBe("fix-bug");
  });

  test("GoalStateEngine and GoalStateSync manage state lifecycle and markdown persistence", () => {
    const state = GoalStateEngine.initGoal(testTmpDir, "Unit test goal objective", "All tests green");
    expect(state.status).toBe("ACTIVE");
    expect(state.objective).toBe("Unit test goal objective");

    const updated = GoalStateEngine.updateProgress(testTmpDir, "Implemented step 1");
    expect(updated.turnsCount).toBe(2);

    const syncRes = GoalStateSync.syncStateToMarkdown(testTmpDir);
    expect(syncRes.goalMdWritten).toBeTrue();
    expect(syncRes.runLogMdWritten).toBeTrue();

    const goalMdContent = readFileSync(join(testTmpDir, "GOAL.md"), "utf8");
    expect(goalMdContent).toContain("Unit test goal objective");
    expect(goalMdContent).toContain("Implemented step 1");

    const paused = GoalStateEngine.pauseGoal(testTmpDir);
    expect(paused.status).toBe("PAUSED");

    const resumed = GoalStateEngine.resumeGoal(testTmpDir);
    expect(resumed.status).toBe("ACTIVE");

    const cleared = GoalStateEngine.clearGoal(testTmpDir);
    expect(cleared?.status).toBe("CLEARED");
  });

  test("handleGoalCommand executes subcommands with human and JSON output", () => {
    const auditOutput = handleGoalCommand({ subcommand: "audit", format: "human", projectDir: root });
    expect(auditOutput).toContain("DOKION GOAL AUDIT REPORT");

    const auditJson = handleGoalCommand({ subcommand: "audit", format: "json", projectDir: root });
    const parsedAudit = JSON.parse(auditJson);
    expect(parsedAudit.readinessScore).toBeDefined();

    const estimateOutput = handleGoalCommand({ subcommand: "estimate", level: "G3", format: "human" });
    expect(estimateOutput).toContain("DOKION GOAL ESTIMATION SUMMARY");
    expect(estimateOutput).toContain("Level: G3");

    const initOutput = handleGoalCommand({ subcommand: "init", pattern: "tests-green", format: "human", projectDir: testTmpDir });
    expect(initOutput).toContain("Scaffolded Goal Engineering");
    expect(existsSync(join(testTmpDir, "GOAL.md"))).toBeTrue();
    expect(existsSync(join(testTmpDir, "goal-budget.md"))).toBeTrue();

    const statusOutput = handleGoalCommand({ subcommand: "status", format: "human", projectDir: testTmpDir });
    expect(statusOutput).toContain("DOKION GOAL ACTIVE STATUS");

    const pauseOutput = handleGoalCommand({ subcommand: "pause", format: "human", projectDir: testTmpDir });
    expect(pauseOutput).toContain("Goal paused");

    const resumeOutput = handleGoalCommand({ subcommand: "resume", format: "human", projectDir: testTmpDir });
    expect(resumeOutput).toContain("Goal resumed");

    const clearOutput = handleGoalCommand({ subcommand: "clear", format: "human", projectDir: testTmpDir });
    expect(clearOutput).toContain("Active goal cleared");
  });
});
