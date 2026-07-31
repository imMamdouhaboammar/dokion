import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DokionError } from "../../core/errors.ts";
import { LoopAuditEngine } from "../../loop-engineering/audit.ts";
import { LoopBudgetTracker } from "../../loop-engineering/budget.ts";
import { LoopContextManager } from "../../loop-engineering/context.ts";
import { LoopPatterns } from "../../loop-engineering/patterns.ts";
import { LoopStateSync } from "../../loop-engineering/sync.ts";
import type { CliOutputFormat } from "../types.ts";

export interface LoopCliOptions {
  subcommand: "audit" | "init" | "cost" | "sync" | "context";
  pattern?: string;
  format: CliOutputFormat;
  projectDir?: string;
}

export function handleLoopCommand(options: LoopCliOptions): string {
  const projectDir = options.projectDir || process.cwd();

  switch (options.subcommand) {
    case "audit": {
      const report = LoopAuditEngine.audit(projectDir);
      if (options.format === "json") {
        return JSON.stringify(report, null, 2);
      }
      const lines = [
        "=========================================",
        "        DOKION LOOP AUDIT REPORT         ",
        "=========================================",
        `Readiness Score: ${report.readinessScore}/100 [${report.grade}]`,
        `Target Directory: ${report.targetPath}`,
        "",
        "Breakdown:",
      ];
      for (const item of report.items) {
        const icon = item.passed ? "✓" : "✗";
        lines.push(`  ${icon} ${item.name} (${item.score}/${item.maxScore} pts)`);
        lines.push(`    ${item.details}`);
      }
      if (report.topRecommendations.length > 0) {
        lines.push("", "Top Recommendations:");
        for (const rec of report.topRecommendations) {
          lines.push(`  - ${rec}`);
        }
      }
      return lines.join("\n");
    }

    case "init": {
      const patternId = options.pattern || "daily-triage";
      const template = LoopPatterns.getPattern(patternId) || LoopPatterns.getPattern("daily-triage")!;

      const dokionDir = join(projectDir, ".dokion");
      const pbPath = join(dokionDir, "playbook.json");
      const budgetPath = join(projectDir, "loop-budget.md");

      writeFileSync(pbPath, JSON.stringify(template.playbookTemplate, null, 2), "utf8");
      writeFileSync(budgetPath, template.budgetTemplate, "utf8");

      if (options.format === "json") {
        return JSON.stringify({
          initialized: true,
          pattern: template.id,
          writtenFiles: [pbPath, budgetPath],
        });
      }
      return `✓ Scaffolded Loop Engineering playbook (.dokion/playbook.json) and budget (loop-budget.md) using pattern '${template.id}' (${template.name}).`;
    }

    case "cost": {
      const budgetConfig = LoopBudgetTracker.loadBudgetConfig(projectDir);
      const usage = LoopBudgetTracker.estimateCost(150_000, 30_000); // estimated run sample
      const check = LoopBudgetTracker.isWithinBudget(usage, 1, budgetConfig);

      if (options.format === "json") {
        return JSON.stringify({
          budgetConfig,
          estimatedSampleUsage: usage,
          withinBudget: check.allowed,
          reason: check.reason,
        });
      }
      return [
        "=========================================",
        "       DOKION LOOP COST ESTIMATOR        ",
        "=========================================",
        `Max Budget (USD): $${budgetConfig.maxTotalCostUSD ?? 5.0}`,
        `Max Iterations: ${budgetConfig.maxIterations ?? 10}`,
        `Estimated Run Tokens: ${usage.totalTokens.toLocaleString()} (Cost ~$${usage.estimatedCostUSD})`,
        `Budget Status: ${check.allowed ? "ALLOWED" : "EXCEEDED"} ${check.reason ? `(${check.reason})` : ""}`,
      ].join("\n");
    }

    case "sync": {
      const result = LoopStateSync.syncStateToMarkdown(projectDir);
      if (options.format === "json") {
        return JSON.stringify(result);
      }
      return `✓ State synchronized. STATE.md written: ${result.stateMdWritten}, LOOP.md written: ${result.loopMdWritten}`;
    }

    case "context": {
      const summary = LoopContextManager.auditContext(projectDir);
      if (options.format === "json") {
        return JSON.stringify(summary, null, 2);
      }
      return [
        "=========================================",
        "     DOKION LOOP CONTEXT WINDOW AUDIT    ",
        "=========================================",
        `Events Recorded: ${summary.eventsCount}`,
        `Total Log Size: ${(summary.totalBytes / 1024).toFixed(1)} KB`,
        `Estimated Tokens: ${summary.estimatedTokens.toLocaleString()} / ${summary.maxContextTokens.toLocaleString()} (${summary.usagePercentage}%)`,
        `Context Status: ${summary.status}`,
        summary.recommendation ? `Recommendation: ${summary.recommendation}` : "Context is optimal.",
      ].join("\n");
    }

    default:
      throw new DokionError("CLI_INVALID_ARGUMENT", `Unknown loop subcommand: ${String(options.subcommand)}`);
  }
}
