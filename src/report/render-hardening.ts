import { join } from "node:path";

import { writeTextAtomic } from "../core/json.ts";
import type { DokionState } from "../state/types.ts";

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function availability(value: boolean | undefined): string {
  return value ? "recorded" : "unavailable or unproven";
}

export function renderHardeningMarkdown(state: DokionState): string {
  const platform = state.profile?.platform;
  const lines: string[] = [
    "# Dokion Hardening Report",
    "",
    "> Your rules. Your tools. Proven software.",
    "",
    "## Run",
    "",
    `- Run ID: \`${cell(state.run.id)}\``,
    `- Status: **${cell(state.run.status)}**`,
    `- Started: ${cell(state.run.started_at)}`,
    `- Ended: ${cell(state.run.ended_at ?? "in progress")}`,
    `- Playbook: \`${cell(state.playbook.path)}\``,
    `- Playbook digest: \`${cell(state.playbook.digest)}\``,
    `- Baseline commit: \`${cell(state.baseline?.commit ?? "not captured")}\``,
    "",
    "## Agent platform",
    "",
    `- Agent: \`${cell(state.run.agent ?? "other")}\``,
    `- Agent version: \`${cell(state.run.agent_version ?? "not reported")}\``,
    `- Model: \`${cell(state.run.model ?? "not reported")}\``,
    `- Detection evidence: \`${cell(platform?.detected_by ?? "not recorded")}\``,
    "",
    "| Guarantee | Status |",
    "|---|---|",
    `| Hook enforcement | ${availability(platform?.guarantees.hook_enforcement)} |`,
    `| Subagent isolation | ${availability(platform?.guarantees.subagent_isolation)} |`,
    `| Parallel writes | ${availability(platform?.guarantees.parallel_writes)} |`,
    `| Worktree isolation | ${availability(platform?.guarantees.worktree_isolation)} |`,
    "",
    "### Platform degradations",
    ""
  ];

  const degradations = state.run.degradations ?? [];
  if (degradations.length === 0) {
    lines.push("None recorded. Every platform guarantee listed above has explicit evidence.");
  } else {
    for (const degradation of degradations) lines.push(`- \`${cell(degradation)}\``);
  }

  lines.push(
    "",
    "## Declared execution order",
    "",
    "| Stage | Step | Mode | Status | Attempts | Evidence |",
    "|---|---|---|---|---:|---:|"
  );

  for (const stage of state.stages) {
    for (const step of stage.steps) {
      lines.push(
        `| ${cell(stage.id)} | ${cell(step.id)} | ${cell(step.mode ?? "")} | ${cell(step.status)} | ${cell(step.attempts ?? 0)} | ${cell(step.evidence?.length ?? 0)} |`
      );
    }
  }

  const failed = state.stages.flatMap((stage) =>
    stage.steps
      .filter((step) => ["FAILED", "BLOCKED", "AWAITING_APPROVAL", "STOPPED_BY_POLICY"].includes(step.status))
      .map((step) => ({ stage: stage.id, step }))
  );

  lines.push("", "## Active blockers", "");
  if (failed.length === 0) {
    lines.push("None recorded by the declared steps.");
  } else {
    for (const item of failed) {
      lines.push(`- \`${cell(item.stage)}/${cell(item.step.id)}\`: ${cell(item.step.failure_reason ?? item.step.status)}`);
    }
  }

  lines.push("", "## Evidence", "");
  const evidence = state.stages.flatMap((stage) => stage.steps.flatMap((step) => step.evidence ?? []));
  if (evidence.length === 0) {
    lines.push("No evidence artifacts recorded yet.");
  } else {
    for (const artifact of evidence) lines.push(`- \`${cell(artifact)}\``);
  }

  lines.push("", "## Integrity", "");
  if (state.playbook.tainted) {
    lines.push(
      `The run is **TAINTED**. Expected \`${cell(state.playbook.tainted.expected)}\`, observed \`${cell(state.playbook.tainted.observed)}\` before \`${cell(state.playbook.tainted.detected_before_step ?? "unknown step")}\`.`
    );
  } else if (state.run.stale) {
    lines.push(
      `The run is **STALE** because repository identity changed in: ${state.run.stale.changed_fields.map((field) => `\`${cell(field)}\``).join(", ")}. Stored identity values are not rendered in this report.`
    );
  } else {
    lines.push(`The active playbook digest was stable at the last recorded checkpoint: \`${cell(state.playbook.digest)}\`.`);
  }

  lines.push("", "## Readiness statement", "");
  if (state.run.status === "COMPLETED") {
    lines.push(
      `This repository passed the user-configured Dokion steps implemented in this run at commit \`${cell(state.baseline?.commit ?? "unknown")}\`. Remaining limitations, platform degradations, manual checks, skipped steps, uncovered lanes, and accepted risks must be evaluated before any broader readiness claim.`
    );
  } else {
    lines.push("No completion claim is active. The run has not completed every declared step with stored verification evidence.");
  }

  lines.push("", "## Suggested Playbook Changes", "", "Recommendations are inert and are never applied automatically.", "");
  return `${lines.join("\n")}\n`;
}

export async function writeHardeningReport(root: string, state: DokionState): Promise<void> {
  await writeTextAtomic(join(root, "HARDENING.md"), renderHardeningMarkdown(state));
}
