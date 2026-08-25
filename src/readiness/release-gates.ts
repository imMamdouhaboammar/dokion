import { join } from "node:path";

import { writeJsonAtomic } from "../core/json.ts";
import { runCommand } from "../engine/command-runner.ts";
import type { DokionPlaybook } from "../playbook/types.ts";
import type { DokionState, ReleaseGateState } from "../state/types.ts";
import type { NormalizedFinding } from "../findings/types.ts";

const OPEN_FINDING_STATUSES = new Set([
  "OPEN",
  "APPROVED_FOR_FIX",
  "FIXING",
  "FIXED_PENDING_VERIFICATION"
]);

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function isOpen(finding: NormalizedFinding): boolean {
  return OPEN_FINDING_STATUSES.has(finding.status);
}

function evaluateCondition(input: {
  condition: string;
  playbook: DokionPlaybook;
  state: DokionState;
  findings: NormalizedFinding[];
}): { passed: boolean; evaluated: string } {
  const condition = input.condition.trim();
  if (condition === "open_findings.CRITICAL == 0") {
    const count = input.findings.filter((finding) => isOpen(finding) && finding.severity === "CRITICAL").length;
    return { passed: count === 0, evaluated: `open_findings.CRITICAL=${count}` };
  }
  if (condition === "required_steps_complete == true") {
    const incomplete = input.state.stages.flatMap((stageState) => {
      const stage = input.playbook.stages.find((candidate) => candidate.id === stageState.id);
      if (!stage) return [];
      return stageState.steps.filter((stepState) => {
        const step = stage.steps.find((candidate) => candidate.id === stepState.id);
        return step?.required !== false && !["SUCCEEDED", "SKIPPED_INAPPLICABLE"].includes(stepState.status);
      });
    }).length;
    return { passed: incomplete === 0, evaluated: `required_steps_incomplete=${incomplete}` };
  }
  if (condition === "run_tainted == false") {
    const tainted = input.state.run.status === "TAINTED";
    return { passed: !tainted, evaluated: `run_tainted=${tainted}` };
  }
  if (condition === "blocking_coverage_lanes_unassigned == 0") {
    const count = (input.state.coverage ?? []).filter((lane) => lane.blocking && lane.status === "UNASSIGNED").length;
    return { passed: count === 0, evaluated: `blocking_coverage_lanes_unassigned=${count}` };
  }
  return { passed: false, evaluated: `unsupported_condition:${condition}` };
}

export async function evaluateReleaseGates(input: {
  root: string;
  playbook: DokionPlaybook;
  state: DokionState;
  findings: NormalizedFinding[];
  forceRerun?: boolean;
  evidenceAttempt?: string;
  evidenceCommitSha?: string;
}): Promise<ReleaseGateState[]> {
  const gates = input.playbook.release_gates ?? [];
  const existingById = new Map((input.state.release_gates ?? []).map((gate) => [gate.id, gate]));
  const results: ReleaseGateState[] = [];
  const verificationAttempt = input.evidenceAttempt;

  for (const gate of gates) {
    if (gate.command !== undefined) {
      const existing = existingById.get(gate.id);
      if (!input.forceRerun && existing && existing.status === "PASS") {
        results.push(existing);
        continue;
      }
      const gateSegment = safeSegment(gate.id);
      const evidenceRoot = verificationAttempt
        ? `.dokion/evidence/${input.state.run.id}/verify/${verificationAttempt}/release-gates`
        : `.dokion/evidence/${input.state.run.id}/release-gates`;
      const outputPrefix = `${evidenceRoot}/${gateSegment}-output`;
      const commandResult = await runCommand(input.root, gate.command, {
        artifactPrefix: outputPrefix
      });
      const artifact = `${evidenceRoot}/${gateSegment}.json`;
      await writeJsonAtomic(join(input.root, artifact), {
        gate_id: gate.id,
        command: commandResult.command,
        command_identity: commandResult.commandIdentity,
        command_kind: commandResult.commandKind,
        shell_parsing: commandResult.shellParsing,
        risk: commandResult.risk,
        degradations: commandResult.degradations,
        stdout: commandResult.stdout,
        stderr: commandResult.stderr,
        stdout_artifact: commandResult.stdoutArtifact,
        stderr_artifact: commandResult.stderrArtifact,
        exit_code: commandResult.exitCode,
        started_at: commandResult.startedAt,
        ended_at: commandResult.endedAt,
        duration_ms: commandResult.durationMs,
        commit_sha: input.evidenceCommitSha ?? input.state.baseline?.commit ?? null
      });
      results.push({
        id: gate.id,
        status: commandResult.exitCode === 0 ? "PASS" : "FAIL",
        blocking: gate.blocking,
        evaluated: commandResult.command,
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
      const ranAt = new Date().toISOString();
      const artifact = verificationAttempt
        ? `.dokion/evidence/${input.state.run.id}/verify/${verificationAttempt}/release-gates/${safeSegment(gate.id)}.json`
        : undefined;
      if (artifact) {
        await writeJsonAtomic(join(input.root, artifact), {
          gate_id: gate.id,
          condition: gate.condition,
          evaluated: conditionResult.evaluated,
          status: conditionResult.passed ? "PASS" : "FAIL",
          blocking: gate.blocking,
          ran_at: ranAt,
          commit_sha: input.evidenceCommitSha ?? input.state.baseline?.commit ?? null
        });
      }
      results.push({
        id: gate.id,
        status: conditionResult.passed ? "PASS" : "FAIL",
        blocking: gate.blocking,
        evaluated: conditionResult.evaluated,
        ...(artifact ? { artifact } : {}),
        ran_at: ranAt
      });
      continue;
    }

    results.push({
      id: gate.id,
      status: "FAIL",
      blocking: gate.blocking,
      evaluated: "release gate has neither command nor condition",
      ran_at: new Date().toISOString()
    });
  }

  return results;
}
