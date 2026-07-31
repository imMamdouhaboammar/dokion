import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { LoopAuditEngine } from "../../src/loop-engineering/audit.ts";
import { LoopBudgetTracker } from "../../src/loop-engineering/budget.ts";
import { LoopContextManager } from "../../src/loop-engineering/context.ts";
import { LoopPatterns } from "../../src/loop-engineering/patterns.ts";
import { LoopStateSync } from "../../src/loop-engineering/sync.ts";
import { handleLoopCommand } from "../../src/cli/handlers/loop.ts";

describe("Loop Engineering Integration Suite", () => {
  const root = process.cwd();

  test("LoopAuditEngine audits local repository readiness", () => {
    const report = LoopAuditEngine.audit(root);
    expect(report.readinessScore).toBeGreaterThanOrEqual(0);
    expect(report.readinessScore).toBeLessThanOrEqual(100);
    expect(report.items.length).toBe(5);
  });

  test("LoopBudgetTracker calculates cost estimates correctly", () => {
    const usage = LoopBudgetTracker.estimateCost(100_000, 20_000);
    expect(usage.inputTokens).toBe(100_000);
    expect(usage.outputTokens).toBe(20_000);
    expect(usage.totalTokens).toBe(120_000);
    expect(usage.estimatedCostUSD).toBeGreaterThan(0);
  });

  test("LoopPatterns returns valid templates for daily-triage and test-driven-loop", () => {
    const triage = LoopPatterns.getPattern("daily-triage");
    expect(triage!.id).toBe("daily-triage");
    expect(triage!.playbookTemplate.pattern).toBe("daily-triage");

    const tdd = LoopPatterns.getPattern("test-driven-loop");
    expect(tdd!.id).toBe("test-driven-loop");
    expect(tdd!.playbookTemplate.pattern).toBe("test-driven-loop");
  });

  test("LoopContextManager audits context window accurately", () => {
    const summary = LoopContextManager.auditContext(root);
    expect(summary.maxContextTokens).toBe(200_000);
    expect(summary.status).toBe("OPTIMAL");
  });

  test("handleLoopCommand handles audit, cost, and context subcommands cleanly", () => {
    const auditOutput = handleLoopCommand({ subcommand: "audit", format: "human", projectDir: root });
    expect(auditOutput).toContain("DOKION LOOP AUDIT REPORT");

    const costOutput = handleLoopCommand({ subcommand: "cost", format: "human", projectDir: root });
    expect(costOutput).toContain("DOKION LOOP COST ESTIMATOR");

    const contextOutput = handleLoopCommand({ subcommand: "context", format: "human", projectDir: root });
    expect(contextOutput).toContain("DOKION LOOP CONTEXT WINDOW AUDIT");
  });
});
