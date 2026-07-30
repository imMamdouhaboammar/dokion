import { DokionError } from "../core/errors.ts";
import type { PlatformDegradation } from "../platform/types.ts";
import type { CoverageLaneState, ReleaseGateState } from "../state/types.ts";

export type ReadinessStatus =
  | "NOT_READY"
  | "CONDITIONALLY_READY"
  | "READY_FOR_STAGING"
  | "READY_FOR_PRODUCTION";

export interface QualifiedReadinessInput {
  subject: string;
  status: ReadinessStatus;
  repositoryCommit: string;
  playbookDigest: string;
  capabilityLockDigest: string;
  gates: ReadonlyArray<Pick<ReleaseGateState, "id" | "status" | "blocking">>;
  coverage: ReadonlyArray<Pick<CoverageLaneState, "lane" | "status" | "blocking">>;
  degradations: readonly PlatformDegradation[];
  exclusions: readonly string[];
  evaluatedAt: string;
}

export interface QualifiedReadinessStatement {
  schema_version: 1;
  subject: string;
  status: ReadinessStatus;
  statement: string;
  repository_commit: string;
  playbook_digest: string;
  capability_lock_digest: string;
  evaluated_at: string;
  blocking_gate_failures: string[];
  uncovered_blocking_lanes: string[];
  degradations: PlatformDegradation[];
  exclusions: string[];
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function requireIdentifier(name: string, value: string): void {
  const validDigest = name === "repository commit" || /^sha(?:256|512):[a-f0-9]{64,128}$/i.test(value);
  if (value.trim().length === 0 || !validDigest) {
    throw new DokionError("INVALID_STATE", `Qualified readiness statement requires a valid ${name}`, {
      field: name
    });
  }
}

function statusSentence(status: ReadinessStatus): string {
  switch (status) {
    case "READY_FOR_PRODUCTION":
      return "passed the user-configured production gates";
    case "READY_FOR_STAGING":
      return "passed the user-configured staging gates";
    case "CONDITIONALLY_READY":
      return "is conditionally ready under the recorded limits";
    case "NOT_READY":
      return "is NOT_READY for the user-configured gates";
  }
}

export function formatReadinessStatement(input: QualifiedReadinessInput): QualifiedReadinessStatement {
  requireIdentifier("repository commit", input.repositoryCommit);
  requireIdentifier("playbook digest", input.playbookDigest);
  requireIdentifier("capability lock digest", input.capabilityLockDigest);
  if (input.subject.trim().length === 0 || Number.isNaN(Date.parse(input.evaluatedAt))) {
    throw new DokionError("INVALID_STATE", "Qualified readiness statement requires a subject and valid evaluation time");
  }

  const blockingGateFailures = sortedUnique(
    input.gates.filter((gate) => gate.blocking && gate.status !== "PASS").map((gate) => gate.id)
  );
  const uncoveredBlockingLanes = sortedUnique(
    input.coverage.filter((lane) => lane.blocking && lane.status !== "ASSIGNED").map((lane) => lane.lane)
  );
  const degradations = sortedUnique(input.degradations) as PlatformDegradation[];
  const exclusions = sortedUnique(input.exclusions);
  const claimsReady = input.status === "READY_FOR_STAGING" || input.status === "READY_FOR_PRODUCTION";
  if (claimsReady && (blockingGateFailures.length > 0 || uncoveredBlockingLanes.length > 0)) {
    throw new DokionError("INVALID_STATE", "Ready status conflicts with blocking readiness evidence", {
      status: input.status,
      blocking_gate_failures: blockingGateFailures,
      uncovered_blocking_lanes: uncoveredBlockingLanes
    });
  }

  const describe = (values: readonly string[]): string => values.length === 0 ? "none" : values.join(", ");
  const noClaim = input.status === "NOT_READY" ? " No completion claim is active." : "";
  const statement = `${input.subject} at commit ${input.repositoryCommit} ${statusSentence(input.status)} under playbook ${input.playbookDigest} and capability lock ${input.capabilityLockDigest}, evaluated at ${input.evaluatedAt}. Blocking gate failures: ${describe(blockingGateFailures)}. Uncovered blocking lanes: ${describe(uncoveredBlockingLanes)}. Degradations: ${describe(degradations)}. Exclusions: ${describe(exclusions)}.${noClaim} This is a scoped Dokion result, not a general security or production-readiness guarantee.`;

  return {
    schema_version: 1,
    subject: input.subject,
    status: input.status,
    statement,
    repository_commit: input.repositoryCommit,
    playbook_digest: input.playbookDigest,
    capability_lock_digest: input.capabilityLockDigest,
    evaluated_at: input.evaluatedAt,
    blocking_gate_failures: blockingGateFailures,
    uncovered_blocking_lanes: uncoveredBlockingLanes,
    degradations,
    exclusions
  };
}
