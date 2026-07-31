import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GoalStateEngine } from "./state.ts";

export class GoalStateSync {
  public static syncStateToMarkdown(projectDir: string): { goalMdWritten: boolean; runLogMdWritten: boolean } {
    const state = GoalStateEngine.loadState(projectDir);
    let goalMdWritten = false;
    let runLogMdWritten = false;

    if (!state) {
      return { goalMdWritten, runLogMdWritten };
    }

    // Sync GOAL.md
    const goalMdPath = join(projectDir, "GOAL.md");
    const goalMdLines = [
      `# GOAL: ${state.objective}`,
      "",
      `**Status**: \`${state.status}\``,
      `**Started At**: ${state.startedAt}`,
      `**Last Updated**: ${state.updatedAt}`,
      `**Turns Count**: ${state.turnsCount}`,
      "",
      "## Done Condition",
      state.doneCondition,
      "",
    ];

    if (state.blockedReason) {
      goalMdLines.push("## Block Reason", `> **BLOCKED**: ${state.blockedReason}`, "");
    }

    goalMdLines.push("## Progress Updates");
    for (const update of state.progressLog) {
      const icon = update.completed ? "✓" : update.blockedReason ? "✗" : "•";
      goalMdLines.push(`- [${update.timestamp}] ${icon} ${update.message}`);
    }

    writeFileSync(goalMdPath, goalMdLines.join("\n"), "utf8");
    goalMdWritten = true;

    // Sync goal-run-log.md
    const runLogPath = join(projectDir, "goal-run-log.md");
    const runLogLines = [
      "# Dokion Goal Engineering Run Log",
      "",
      `**Objective**: ${state.objective}`,
      `**Current Status**: ${state.status}`,
      `**Total Turns**: ${state.turnsCount}`,
      "",
      "| Timestamp | Status | Message |",
      "| --- | --- | --- |",
    ];

    for (const update of state.progressLog) {
      const statusLabel = update.completed ? "COMPLETED" : update.blockedReason ? "BLOCKED" : "IN_PROGRESS";
      const sanitizedMessage = update.message.replace(/\|/g, "\\|");
      runLogLines.push(`| ${update.timestamp} | \`${statusLabel}\` | ${sanitizedMessage} |`);
    }

    writeFileSync(runLogPath, runLogLines.join("\n"), "utf8");
    runLogMdWritten = true;

    return { goalMdWritten, runLogMdWritten };
  }
}
