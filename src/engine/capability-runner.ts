import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isApproved } from "../approvals/approval-store.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import { writeCommandEvidence } from "../evidence/evidence-store.ts";
import { listFindings, normalizeFindingEnvelope, updateFinding } from "../findings/finding-store.ts";
import type { NormalizedFinding, RawFindingEnvelope } from "../findings/types.ts";
import type { LoadedPlaybook, PlaybookStage, PlaybookStep } from "../playbook/types.ts";
import type { DokionState, VerificationResult } from "../state/types.ts";
import {
  captureRepairSnapshot,
  diffRepairSnapshots,
  restoreRepairSnapshot,
  type RepairSnapshot
} from "../validation/repair-snapshot.ts";
import { validateRepair } from "../validation/repair-validator.ts";
import { runCommand, type CommandResult } from "./command-runner.ts";

export type CapabilityRunResult =
  | {
      status: "SUCCEEDED";
      findingIds: string[];
      evidence: string[];
      verificationResults: VerificationResult[];
    }
  | {
      status: "AWAITING_APPROVAL";
      subject: string;
      findingIds: string[];
      evidence: string[];
      verificationResults: VerificationResult[];
    }
  | {
      status: "FAILED";
      reason: string;
      findingIds: string[];
      evidence: string[];
      verificationResults: VerificationResult[];
    };

interface NamedEvidenceMetadata {
  phase: "REMEDIATION" | "VERIFICATION";
  finding_id?: string;
  command_index?: number;
}

function invocationCommands(step: PlaybookStep): string[] {
  const verification = new Set(step.verification ?? []);
  return (step.permissions?.shell ?? []).filter((command) => !verification.has(command));
}

function assertAllowed(step: PlaybookStep, command: string): void {
  if (!(step.permissions?.shell ?? []).includes(command)) {
    throw new DokionError("COMMAND_FAILED", "Command is outside permissions.shell", {
      stepId: step.id,
      command,
      allowed: step.permissions?.shell ?? []
    });
  }
}

function requireSingleInvocation(step: PlaybookStep): string {
  const commands = invocationCommands(step);
  if (commands.length !== 1) {
    throw new DokionError("UNSUPPORTED_EXECUTION", `Step ${step.id} must declare exactly one capability command outside verification`, {
      stepId: step.id,
      commands
    });
  }
  return commands[0]!;
}

async function writeNamedCommandEvidence(
  root: string,
  relativePath: string,
  result: CommandResult,
  metadata: NamedEvidenceMetadata
): Promise<string> {
  await writeJsonAtomic(join(root, relativePath), {
    ...metadata,
    command: result.command,
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
    started_at: result.startedAt,
    ended_at: result.endedAt,
    duration_ms: result.durationMs
  });
  return relativePath;
}

async function restoreCurrentRepair(root: string, before: RepairSnapshot): Promise<void> {
  const current = await captureRepairSnapshot(root);
  await restoreRepairSnapshot(root, before, diffRepairSnapshots(before, current));
}

function approvalSubject(step: PlaybookStep, finding: NormalizedFinding): string | undefined {
  if (step.mode === "FIX_AUTOMATICALLY") return undefined;
  const policy = step.approval ?? "BEFORE_WRITE";
  if (policy === "NEVER" || policy === "FROM_PLAYBOOK") return undefined;
  if (policy === "BEFORE_EACH_FIX") return `finding:${finding.id}`;
  return `step:${step.id}`;
}

export async function runAnalyzeCapability(input: {
  root: string;
  loaded: LoadedPlaybook;
  state: DokionState;
  stage: PlaybookStage;
  step: PlaybookStep;
}): Promise<CapabilityRunResult> {
  const command = requireSingleInvocation(input.step);
  assertAllowed(input.step, command);
  const rawArtifact = `.dokion/evidence/${input.state.run.id}/steps/${input.stage.id}/${input.step.id}/raw-findings.json`;
  await mkdir(dirname(join(input.root, rawArtifact)), { recursive: true });
  await rm(join(input.root, rawArtifact), { force: true });

  const result = await runCommand(input.root, command, {
    timeoutSeconds: input.step.timeout_seconds ?? 300,
    env: {
      DOKION_PROTOCOL: "DOKION_FINDINGS_V1",
      DOKION_OUTPUT: join(input.root, rawArtifact),
      DOKION_RUN_ID: input.state.run.id,
      DOKION_STAGE_ID: input.stage.id,
      DOKION_STEP_ID: input.step.id
    }
  });
  const commandArtifact = await writeCommandEvidence(input.root, {
    run_id: input.state.run.id,
    stage_id: input.stage.id,
    step_id: input.step.id,
    command_index: 1,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
    started_at: result.startedAt,
    ended_at: result.endedAt,
    duration_ms: result.durationMs,
    ...(input.state.baseline?.commit ? { commit_sha: input.state.baseline.commit } : {})
  });

  if (result.exitCode !== 0) {
    return { status: "FAILED", reason: `Capability command exited ${result.exitCode}`, findingIds: [], evidence: [commandArtifact], verificationResults: [] };
  }
  if (!(await Bun.file(join(input.root, rawArtifact)).exists())) {
    return { status: "FAILED", reason: "Capability did not create DOKION_OUTPUT", findingIds: [], evidence: [commandArtifact], verificationResults: [] };
  }

  const envelope = await readJson<RawFindingEnvelope>(join(input.root, rawArtifact));
  const findings = await normalizeFindingEnvelope({
    root: input.root,
    envelope,
    stageId: input.stage.id,
    stepId: input.step.id,
    capabilityId: input.step.capability.id,
    ...(input.step.capability.version ? { capabilityVersion: input.step.capability.version } : {}),
    rawArtifact,
    runId: input.state.run.id
  });
  const findingIds = findings.map((finding) => finding.id);
  const evidence = [commandArtifact, rawArtifact];
  const verificationResults: VerificationResult[] = [
    { command, exit_code: result.exitCode, artifact: commandArtifact, ran_at: result.endedAt }
  ];
  const verificationCommands = input.step.verification ?? [];

  if (verificationCommands.length === 0) {
    return {
      status: "FAILED",
      reason: "No verification command is declared for analysis capability",
      findingIds,
      evidence,
      verificationResults
    };
  }

  for (const [index, verificationCommand] of verificationCommands.entries()) {
    if (!(input.step.permissions?.shell ?? []).includes(verificationCommand)) {
      return {
        status: "FAILED",
        reason: "Verification command is outside permissions.shell",
        findingIds,
        evidence,
        verificationResults
      };
    }

    const verification = await runCommand(input.root, verificationCommand, {
      timeoutSeconds: input.step.timeout_seconds ?? 300
    });
    const artifact = `.dokion/evidence/${input.state.run.id}/steps/${input.stage.id}/${input.step.id}/verification-${index + 1}.json`;
    evidence.push(await writeNamedCommandEvidence(input.root, artifact, verification, {
      phase: "VERIFICATION",
      command_index: index + 1
    }));
    verificationResults.push({
      command: verificationCommand,
      exit_code: verification.exitCode,
      artifact,
      ran_at: verification.endedAt
    });

    if (verification.exitCode !== 0) {
      return {
        status: "FAILED",
        reason: `Verification command exited ${verification.exitCode}`,
        findingIds,
        evidence,
        verificationResults
      };
    }
  }

  return {
    status: "SUCCEEDED",
    findingIds,
    evidence,
    verificationResults
  };
}

export async function runRemediationCapability(input: {
  root: string;
  loaded: LoadedPlaybook;
  state: DokionState;
  stage: PlaybookStage;
  step: PlaybookStep;
}): Promise<CapabilityRunResult> {
  const command = requireSingleInvocation(input.step);
  assertAllowed(input.step, command);
  const sourceSteps = new Set(input.step.depends_on ?? []);
  const findings = (await listFindings(input.root)).filter(
    (finding) => sourceSteps.has(finding.step_id) && ["OPEN", "APPROVED_FOR_FIX", "FIXING", "FIXED_PENDING_VERIFICATION"].includes(finding.status)
  );
  const evidence: string[] = [];
  const verificationResults: VerificationResult[] = [];

  for (const finding of findings) {
    const subject = approvalSubject(input.step, finding);
    if (subject && !isApproved(input.state, subject)) {
      return {
        status: "AWAITING_APPROVAL",
        subject,
        findingIds: findings.map((item) => item.id),
        evidence,
        verificationResults
      };
    }

    await updateFinding(input.root, finding.id, (current) => ({
      ...current,
      status: subject ? "APPROVED_FOR_FIX" : current.status
    }));
    await updateFinding(input.root, finding.id, (current) => ({ ...current, status: "FIXING" }));

    const before = await captureRepairSnapshot(input.root);
    const findingFile = join(input.root, ".dokion", "findings", `${finding.id}.json`);
    const result = await runCommand(input.root, command, {
      timeoutSeconds: input.step.timeout_seconds ?? 300,
      env: {
        DOKION_PROTOCOL: "DOKION_REMEDIATION_V1",
        DOKION_FINDING_ID: finding.id,
        DOKION_FINDING_FILE: findingFile,
        DOKION_RUN_ID: input.state.run.id,
        DOKION_STAGE_ID: input.stage.id,
        DOKION_STEP_ID: input.step.id
      }
    });
    const remediationArtifact = `.dokion/evidence/${input.state.run.id}/findings/${finding.id}/remediation.json`;
    evidence.push(await writeNamedCommandEvidence(input.root, remediationArtifact, result, {
      finding_id: finding.id,
      phase: "REMEDIATION"
    }));

    const validation = await validateRepair({
      root: input.root,
      runId: input.state.run.id,
      findingId: finding.id,
      writeScopes: input.step.permissions?.write ?? [],
      policy: input.step.validation ?? input.loaded.data.defaults?.validation ?? {},
      before
    });
    evidence.push(validation.diffArtifact);
    const capturedAt = new Date().toISOString();

    if (result.exitCode !== 0) {
      await restoreCurrentRepair(input.root, before);
      await updateFinding(input.root, finding.id, (current) => ({ ...current, status: "BLOCKED" }));
      return {
        status: "FAILED",
        reason: `Remediation command exited ${result.exitCode}`,
        findingIds: findings.map((item) => item.id),
        evidence,
        verificationResults
      };
    }

    if (validation.verdict !== "FIX_HOLDS") {
      await updateFinding(input.root, finding.id, (current) => ({
        ...current,
        status: "REPAIR_REJECTED",
        evidence: [
          ...current.evidence,
          { kind: "diff", path: validation.diffArtifact, digest: validation.diffDigest, captured_at: capturedAt, phase: "AFTER" }
        ],
        resolution: {
          diff_artifact: validation.diffArtifact,
          adversary_verdict: validation.verdict,
          resolved_at: capturedAt
        }
      }));
      await restoreRepairSnapshot(input.root, before, diffRepairSnapshots(before, validation.after));
      return {
        status: "FAILED",
        reason: validation.violations.join("; ") || "Adversarial validation rejected the repair",
        findingIds: findings.map((item) => item.id),
        evidence,
        verificationResults
      };
    }

    await updateFinding(input.root, finding.id, (current) => ({
      ...current,
      status: "FIXED_PENDING_VERIFICATION",
      evidence: [
        ...current.evidence,
        { kind: "diff", path: validation.diffArtifact, digest: validation.diffDigest, captured_at: capturedAt, phase: "AFTER" }
      ]
    }));

    const findingVerificationArtifacts: string[] = [];
    for (const [index, verificationCommand] of (input.step.verification ?? []).entries()) {
      assertAllowed(input.step, verificationCommand);
      const verification = await runCommand(input.root, verificationCommand, {
        timeoutSeconds: input.step.timeout_seconds ?? 300
      });
      const artifact = `.dokion/evidence/${input.state.run.id}/findings/${finding.id}/verification-${index + 1}.json`;
      findingVerificationArtifacts.push(await writeNamedCommandEvidence(input.root, artifact, verification, {
        finding_id: finding.id,
        phase: "VERIFICATION"
      }));
      verificationResults.push({ command: verificationCommand, exit_code: verification.exitCode, artifact, ran_at: verification.endedAt });
      evidence.push(artifact);
      if (verification.exitCode !== 0) {
        await restoreCurrentRepair(input.root, before);
        await updateFinding(input.root, finding.id, (current) => ({
          ...current,
          status: "REPAIR_REJECTED",
          resolution: {
            diff_artifact: validation.diffArtifact,
            adversary_verdict: "FIX_INCOMPLETE",
            resolved_at: new Date().toISOString()
          }
        }));
        return {
          status: "FAILED",
          reason: `Verification command exited ${verification.exitCode}`,
          findingIds: findings.map((item) => item.id),
          evidence,
          verificationResults
        };
      }
    }

    const regressionTest = input.step.validation?.require_regression_test ? validation.changedTestPaths[0] : undefined;
    await updateFinding(input.root, finding.id, (current) => ({
      ...current,
      status: "VERIFIED",
      evidence: [
        ...current.evidence,
        ...findingVerificationArtifacts.map((path) => ({ kind: "test_result" as const, path, captured_at: new Date().toISOString(), phase: "AFTER" as const }))
      ],
      resolution: {
        diff_artifact: validation.diffArtifact,
        ...(regressionTest ? { regression_test: regressionTest } : {}),
        verified_by: (input.step.verification ?? []).slice(),
        adversary_verdict: "FIX_HOLDS",
        resolved_at: new Date().toISOString()
      }
    }));
  }

  return {
    status: "SUCCEEDED",
    findingIds: findings.map((finding) => finding.id),
    evidence,
    verificationResults
  };
}
