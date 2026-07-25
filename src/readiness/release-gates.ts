import { join } from "node:path";

import { writeJsonAtomic } from "../core/json.ts";
import { runCommand } from "../engine/command-runner.ts";
import type { NormalizedFinding } from "../findings/types.ts";
import type { DokionPlaybook, ReleaseGateDefinition } from "../playbook/types.ts";
import type { DokionState, ReleaseGateState } from "../state/types.ts";

const closedFindingStatuses = new Set<NormalizedFinding["status"]>([
  "VERIFIED",
  "FALSE_POSITIVE",
  "ACCEPTED_RISK",
  "DEFERRED",
  "NOT_APPLICABLE"
]);

const completedRequiredStepStatuses = new Set([
  "SUCCEEDED",
  "SKIPPED_INAPPLICABLE"
]);

function definitions(playbook: DokionPlaybook): ReleaseGateDefinition[] {
  return playbook.release_gates ?? [];
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function activeFindingCount(findings: NormalizedFinding[], severity: NormalizedFinding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity && !closedFindingStatuses.has(finding.status)).length;
}

function requiredStepsComplete(playbook: DokionPlaybook, state: DokionState): boolean {
  const stateById = new Map(
    state.stages.flatMap((stage) => stage.steps.map((step) => [step.id, step.status] as const))
  );
  return playbook.stages.every((stage) =>
    stage.steps.every((step) => {
      if (step.required === false) return true;
      const status = stateById.get(step.id);
      return status !== undefined && completedRequiredStepStatuses.has(status);
    })
  );
}

function blockingLanesAssigned(playbook: DokionPlaybook, state: DokionState): boolean {
  const coverageByLane = new Map((state.coverage ?? []).map((lane) => [lane.lane, lane] as const));
  const blockingLanes = new Set([
    ...(playbook.coverage_policy?.blocking_lanes ?? []),
    ...(state.coverage ?? []).filter((lane) => lane.blocking).map((lane) => lane.lane)
  ]);
  return [...blockingLanes].every((lane) => coverageByLane.get(lane)?.status === "ASSIGNED");
}

function evaluateCondition(input: {
  condition: string;
  playbook: DokionPlaybook;
  state: DokionState;
  findings: NormalizedFinding[];
}): { passed: boolean; evaluated: string } {
  const criticalMatch = /^open_findings\.(CRITICAL|HIGH|MEDIUM|LOW|INFO)\s*==\s*0$/.exec(input.condition);
  if (criticalMatch) {
    const severity = criticalMatch[1] as NormalizedFinding["severity"];
    const count = activeFindingCount(input.findings, severity);
    return {
      passed: count === 0,
      evaluated: `${input.condition} (observed ${count})`
    };
  }

  if (input.condition === "required_steps_complete == true") {
    const passed = requiredStepsComplete(input.playbook, input.state);
    return { passed, evaluated: `${input.condition} (observed ${passed})` };
  }

  if (input.condition === "playbook_tainted == false") {
    const tainted = input.state.run.status === "TAINTED" || input.state.playbook.tainted !== undefined;
    return { passed: !tainted, evaluated: `${input.condition} (observed ${tainted})` };
  }

  if (input.condition === "blocking_lanes_assigned == true") {
    const passed = blockingLanesAssigned(input.playbook, input.state);
    return { passed, evaluated: `${input.condition} (observed ${passed})` };
  }

  return {
    passed: false,
    evaluated: `unsupported condition: ${input.condition}`
  };
}

export async function evaluateReleaseGates(input: {
  root: string;
  playbook: DokionPlaybook;
  state: DokionState;
  findings: NormalizedFinding[];
}): Promise<ReleaseGateState[]> {
  const results: ReleaseGateState[] = [];
  const existingById = new Map((input.state.release_gates ?? []).map((gate) => [gate.id, gate] as const));

  for (const gate of definitions(input.playbook)) {
    if (gate.command !== undefined) {
      const existing = existingById.get(gate.id);
      if (existing && existing.status === "PASS") {
        results.push(existing);
        continue;
      }
      const commandResult = await runCommand(input.root, gate.command);
      const artifact = `.dokion/evidence/${input.state.run.id}/release-gates/${safeSegment(gate.id)}.json`;
      await writeJsonAtomic(join(input.root, artifact), {
        gate_id: gate.id,
        command: gate.command,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        exit_code: commandResult.exitCode,
        started_at: commandResult.startedAt,
        ended_at: commandResult.endedAt,
        duration_ms: commandResult.durationMs,
        commit_sha: input.state.baseline?.commit ?? null
      });
      results.push({
        id: gate.id,
        status: commandResult.exitCode === 0 ? "PASS" : "FAIL",
        blocking: gate.blocking,
        evaluated: gate.command,
        exit_code: commandResult.exitCode,
        artifact,
        ran_at: commandResult.endedAt
      });
      continue;
    }

    if (gate.condition !== undefined) {
      const conditionResult = evaluateCondition({
        condition: gate.condition,
        playbook: input.playbook,
        state: input.state,
        findings: input.findings
      });
      results.push({
        id: gate.id,
        status: conditionResult.passed ? "PASS" : "FAIL",
        blocking: gate.blocking,
        evaluated: conditionResult.evaluated,
        ran_at: new Date().toISOString()
      });
      continue;
    }

    results.push({
      id: gate.id,
      status: "FAIL",
      blocking: gate.blocking,
      evaluated: "gate has neither command nor condition",
      ran_at: new Date().toISOString()
    });
  }

  return results;
}
