import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DokionError } from "../../core/errors.ts";
import { GoalAuditEngine } from "../../goal-engineering/audit.ts";
import { GoalBudgetTracker } from "../../goal-engineering/budget.ts";
import { GoalPatterns } from "../../goal-engineering/patterns.ts";
import { GoalStateEngine } from "../../goal-engineering/state.ts";
import { GoalStateSync } from "../../goal-engineering/sync.ts";
import type { CliOutputFormat } from "../types.ts";

export interface GoalCliOptions {
  subcommand: "audit" | "doctor" | "init" | "estimate" | "status" | "pause" | "resume" | "clear" | "sync" | "run";
  pattern?: string;
  level?: string;
  objective?: string;
  format: CliOutputFormat;
  projectDir?: string;
}

export function handleGoalCommand(options: GoalCliOptions): string {
  const projectDir = options.projectDir || process.cwd();

  switch (options.subcommand) {
    case "doctor":
    case "audit": {
      const report = GoalAuditEngine.audit(projectDir);
      if (options.format === "json") {
        return JSON.stringify(report, null, 2);
      }
      const lines = [
        "=========================================",
        "        DOKION GOAL AUDIT REPORT         ",
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
      const patternId = options.pattern || "tests-green";
      const pattern = GoalPatterns.getPattern(patternId) || GoalPatterns.getPattern("tests-green")!;

      const goalMdPath = join(projectDir, "GOAL.md");
      const budgetPath = join(projectDir, "goal-budget.md");

      writeFileSync(goalMdPath, pattern.goalMdTemplate, "utf8");
      writeFileSync(budgetPath, pattern.budgetTemplate, "utf8");

      GoalStateEngine.initGoal(projectDir, pattern.name, "Verifier test command passes");
      GoalStateSync.syncStateToMarkdown(projectDir);

      if (options.format === "json") {
        return JSON.stringify({
          initialized: true,
          pattern: pattern.id,
          writtenFiles: [goalMdPath, budgetPath],
        });
      }
      return `✓ Scaffolded Goal Engineering GOAL.md and goal-budget.md using pattern '${pattern.id}' (${pattern.name}).`;
    }

    case "estimate": {
      const level = options.level || "G2";
      const estimate = GoalBudgetTracker.getEstimate(level);

      if (options.format === "json") {
        return JSON.stringify(estimate, null, 2);
      }
      return [
        "=========================================",
        "     DOKION GOAL ESTIMATION SUMMARY      ",
        "=========================================",
        `Level: ${estimate.level} (${estimate.name})`,
        `Description: ${estimate.description}`,
        `Estimated Tokens: ${estimate.estimatedTokens.toLocaleString()}`,
        `Max Allowed Turns: ${estimate.maxTurns}`,
        `Estimated Cost (USD): ~$${estimate.estimatedCostUSD.toFixed(2)}`,
      ].join("\n");
    }

    case "status": {
      const state = GoalStateEngine.loadState(projectDir);
      const budgetConfig = GoalBudgetTracker.loadBudgetConfig(projectDir);

      if (options.format === "json") {
        return JSON.stringify({ state, budgetConfig }, null, 2);
      }

      if (!state) {
        return "No active goal state found. Run 'dokion goal init' or 'dokion goal run <objective>' to begin.";
      }

      const lines = [
        "=========================================",
        "        DOKION GOAL ACTIVE STATUS        ",
        "=========================================",
        `Objective: ${state.objective}`,
        `Status: ${state.status}`,
        `Done Condition: ${state.doneCondition}`,
        `Started At: ${state.startedAt}`,
        `Turns Completed: ${state.turnsCount} / max ${budgetConfig.maxTurns}`,
        state.blockedReason ? `Blocked Reason: ${state.blockedReason}` : "",
        "",
        "Progress Updates:",
      ];

      for (const update of state.progressLog) {
        const icon = update.completed ? "✓" : update.blockedReason ? "✗" : "•";
        lines.push(`  ${icon} [${update.timestamp}] ${update.message}`);
      }

      return lines.filter(Boolean).join("\n");
    }

    case "run": {
      const objective = options.objective || options.pattern || "Autonomous objective run";
      const state = GoalStateEngine.initGoal(projectDir, objective);
      GoalStateSync.syncStateToMarkdown(projectDir);

      if (options.format === "json") {
        return JSON.stringify(state, null, 2);
      }
      return `✓ Initiated Goal: "${objective}" [ACTIVE]. State written to GOAL.md and .dokion/goal-state.json.`;
    }

    case "pause": {
      const state = GoalStateEngine.pauseGoal(projectDir);
      GoalStateSync.syncStateToMarkdown(projectDir);
      if (options.format === "json") {
        return JSON.stringify(state);
      }
      return `✓ Goal paused. Status: ${state.status}.`;
    }

    case "resume": {
      const state = GoalStateEngine.resumeGoal(projectDir);
      GoalStateSync.syncStateToMarkdown(projectDir);
      if (options.format === "json") {
        return JSON.stringify(state);
      }
      return `✓ Goal resumed. Status: ${state.status}.`;
    }

    case "clear": {
      const state = GoalStateEngine.clearGoal(projectDir);
      GoalStateSync.syncStateToMarkdown(projectDir);
      if (options.format === "json") {
        return JSON.stringify({ cleared: true, state });
      }
      return "✓ Active goal cleared.";
    }

    case "sync": {
      const result = GoalStateSync.syncStateToMarkdown(projectDir);
      if (options.format === "json") {
        return JSON.stringify(result);
      }
      return `✓ Goal state synchronized. GOAL.md written: ${result.goalMdWritten}, goal-run-log.md written: ${result.runLogMdWritten}.`;
    }

    default:
      throw new DokionError("CLI_INVALID_ARGUMENT", `Unknown goal subcommand: ${String(options.subcommand)}`);
  }
}
