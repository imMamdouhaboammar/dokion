import { join } from "node:path";

import { writeJsonAtomic } from "../core/json.ts";
import { runCommand } from "../engine/command-runner.ts";
import {
  commandSpecAllowed,
  commandSpecDisplay
} from "../execution/command-policy.ts";
import type { CommandSpecInput } from "../execution/command-spec.ts";
import { invokeCommandCapability } from "../invocation/command-capability-invoker.ts";
import type { PlaybookStage, PlaybookStep } from "../playbook/types.ts";
import type { VerificationResult } from "../state/types.ts";

export interface StepVerificationExecution {
  stageId: string;
  stepId: string;
  commandIndex: number;
  command: string;
  blocking: boolean;
  passed: boolean;
  exitCode: number;
  artifact: string;
  ranAt: string;
}

export interface StepVerificationBatch {
  passed: boolean;
  reason?: string;
  evidence: string[];
  verificationResults: VerificationResult[];
  executions: StepVerificationExecution[];
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function declaredCommands(step: PlaybookStep): CommandSpecInput[] {
  return step.verification ?? [];
}

function commandAllowed(step: PlaybookStep, command: CommandSpecInput): boolean {
  return commandSpecAllowed(step.permissions?.shell, command);
}

export async function executeStepVerification(input: {
  root: string;
  stage: PlaybookStage;
  step: PlaybookStep;
  runId: string;
  commitSha?: string;
  evidenceRoot: string;
  stopOnFailure: boolean;
}): Promise<StepVerificationBatch> {
  const commands = declaredCommands(input.step);
  const evidence: string[] = [];
  const verificationResults: VerificationResult[] = [];
  const executions: StepVerificationExecution[] = [];

  if (input.step.capability.entrypoint?.kind === "command") {
    const invocation = await invokeCommandCapability({
      root: input.root,
      runId: input.runId,
      stage: input.stage,
      step: input.step
    });
    evidence.push(invocation.receiptPath);
    verificationResults.push({
      command: invocation.command,
      exit_code: invocation.exitCode,
      artifact: invocation.receiptPath,
      ran_at: invocation.endedAt
    });
    executions.push({
      stageId: input.stage.id,
      stepId: input.step.id,
      commandIndex: 0,
      command: invocation.command,
      blocking: input.step.required !== false,
      passed: invocation.status === "SUCCEEDED",
      exitCode: invocation.exitCode,
      artifact: invocation.receiptPath,
      ranAt: invocation.endedAt
    });
    if (invocation.status === "FAILED") {
      return {
        passed: false,
        reason: invocation.reason ?? "Capability invocation failed",
        evidence,
        verificationResults,
        executions
      };
    }
    if (commands.length === 0) {
      return {
        passed: true,
        evidence,
        verificationResults,
        executions
      };
    }
  } else if (commands.length === 0) {
    return {
      passed: false,
      reason: "No verification command is declared",
      evidence,
      verificationResults,
      executions
    };
  }

  for (const [index, command] of commands.entries()) {
    if (!commandAllowed(input.step, command)) {
      return {
        passed: false,
        reason: "Verification command is outside permissions.shell",
        evidence,
        verificationResults,
        executions
      };
    }

    const commandIndex = index + 1;
    const artifact = `${input.evidenceRoot}/verification-${commandIndex}.json`;
    const outputPrefix = `${input.evidenceRoot}/verification-${commandIndex}-output`;
    const result = await runCommand(input.root, command, {
      timeoutSeconds: input.step.timeout_seconds ?? 300,
      artifactPrefix: outputPrefix
    });

    await writeJsonAtomic(join(input.root, artifact), {
      run_id: input.runId,
      stage_id: input.stage.id,
      step_id: input.step.id,
      command_index: commandIndex,
      command: result.command,
      command_identity: result.commandIdentity,
      command_kind: result.commandKind,
      shell_parsing: result.shellParsing,
      risk: result.risk,
      degradations: result.degradations,
      stdout: result.stdout,
      stderr: result.stderr,
      stdout_artifact: result.stdoutArtifact,
      stderr_artifact: result.stderrArtifact,
      exit_code: result.exitCode,
      started_at: result.startedAt,
      ended_at: result.endedAt,
      duration_ms: result.durationMs,
      ...(input.commitSha ? { commit_sha: input.commitSha } : {})
    });

    const passed = result.exitCode === 0;
    evidence.push(artifact);
    verificationResults.push({
      command: result.command,
      exit_code: result.exitCode,
      artifact,
      ran_at: result.endedAt
    });
    executions.push({
      stageId: input.stage.id,
      stepId: input.step.id,
      commandIndex,
      command: result.command,
      blocking: input.step.required !== false,
      passed,
      exitCode: result.exitCode,
      artifact,
      ranAt: result.endedAt
    });

    if (!passed && input.stopOnFailure) {
      return {
        passed: false,
        reason: `Verification command exited ${result.exitCode}`,
        evidence,
        verificationResults,
        executions
      };
    }
  }

  const passed = executions.every((execution) => execution.passed);
  return {
    passed,
    ...(!passed ? { reason: "One or more verification commands failed" } : {}),
    evidence,
    verificationResults,
    executions
  };
}

export function stepVerificationEvidenceRoot(
  root: string,
  stageId: string,
  stepId: string
): string {
  return `${root}/${safeSegment(stageId)}/${safeSegment(stepId)}`;
}
