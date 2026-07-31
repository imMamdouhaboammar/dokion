import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DokionState } from "../state/types.ts";

export class LoopStateSync {
  public static syncStateToMarkdown(projectDir: string, state?: DokionState): { stateMdWritten: boolean; loopMdWritten: boolean } {
    let activeState = state;

    if (!activeState) {
      const statePath = join(projectDir, ".dokion", "state.json");
      if (!existsSync(statePath)) return { stateMdWritten: false, loopMdWritten: false };
      try {
        activeState = JSON.parse(readFileSync(statePath, "utf8"));
      } catch {
        return { stateMdWritten: false, loopMdWritten: false };
      }
    }

    if (!activeState) return { stateMdWritten: false, loopMdWritten: false };

    // Render STATE.md
    const stateLines = [
      "# STATE.md",
      "",
      `**Run ID:** \`${activeState.run.id}\``,
      `**Status:** \`${activeState.run.status}\``,
      `**Started At:** ${activeState.run.started_at}`,
      activeState.run.ended_at ? `**Ended At:** ${activeState.run.ended_at}` : "",
      `**Commit SHA:** \`${activeState.repository_identity?.commit || "unknown"}\``,
      `**Branch:** \`${activeState.repository_identity?.branch || "unknown"}\``,
      "",
      "## Stages & Execution Steps",
      "",
    ];

    for (const stage of activeState.stages || []) {
      stateLines.push(`### Stage: ${stage.id} [${stage.status}]`);
      for (const step of stage.steps || []) {
        stateLines.push(`- **${step.id}**: \`${step.status}\` (Attempts: ${step.attempts || 1})`);
        if (step.failure_reason) {
          stateLines.push(`  - *Failure:* ${step.failure_reason}`);
        }
      }
      stateLines.push("");
    }

    if (activeState.findings_index && Object.keys(activeState.findings_index).length > 0) {
      stateLines.push("## Findings Summary");
      stateLines.push(`Total Findings: ${Object.keys(activeState.findings_index).length}`);
      stateLines.push("");
    }

    writeFileSync(join(projectDir, "STATE.md"), stateLines.filter(Boolean).join("\n"), "utf8");

    // Render LOOP.md
    const loopLines = [
      "# LOOP.md",
      "",
      "## Active Loop Context",
      "",
      `Playbook: \`${activeState.playbook.path}\``,
      `Playbook Digest: \`${activeState.playbook.digest.slice(0, 12)}...\``,
      `Agent Platform: \`${activeState.run.agent || "dokion"}\``,
      "",
      "## Loop Protocol",
      "1. Check STATE.md for current stage & step progress.",
      "2. Execute approved step only.",
      "3. Record verification evidence.",
      "4. Sync state after each completion.",
    ];

    writeFileSync(join(projectDir, "LOOP.md"), loopLines.join("\n"), "utf8");

    return { stateMdWritten: true, loopMdWritten: true };
  }
}
