import type {
  CoverageGapAcknowledgement,
  CoverageLaneStatus,
  DokionPlaybook,
  ReadinessCap
} from "../playbook/types.ts";
import type { CoverageLaneState, DokionState, ExecutionStatus } from "../state/types.ts";

interface ManifestCoverageGap {
  lane: string;
  status: string;
  reason?: string;
}

export interface CoverageManifest {
  coverage?: {
    gaps_requiring_user_selected_capabilities?: ManifestCoverageGap[];
  };
}

export interface CoverageEvaluation {
  lanes: CoverageLaneState[];
  blocking_unassigned_lanes: string[];
  readiness_cap?: ReadinessCap;
}

const excludedStatuses = new Set<ExecutionStatus>([
  "SKIPPED_INAPPLICABLE",
  "SKIPPED_BY_USER",
  "STOPPED_BY_POLICY"
]);

function statusRank(status: "UNASSIGNED" | CoverageLaneStatus): number {
  if (status === "ASSIGNED") return 2;
  if (status === "PARTIAL") return 1;
  return 0;
}

function strongestStatus(
  current: "UNASSIGNED" | CoverageLaneStatus,
  candidate: "UNASSIGNED" | CoverageLaneStatus
): "UNASSIGNED" | CoverageLaneStatus {
  return statusRank(candidate) > statusRank(current) ? candidate : current;
}

function normalizeManifestStatus(status: string): "UNASSIGNED" | "PARTIAL" {
  return status === "PARTIAL" ? "PARTIAL" : "UNASSIGNED";
}

function acknowledgementMap(acknowledgements: CoverageGapAcknowledgement[]): Map<string, CoverageGapAcknowledgement> {
  return new Map(acknowledgements.map((acknowledgement) => [acknowledgement.lane, acknowledgement]));
}

export function evaluateCoverage(input: {
  manifest: CoverageManifest;
  playbook: DokionPlaybook;
  state: DokionState;
}): CoverageEvaluation {
  const policy = input.playbook.coverage_policy ?? {};
  const blockingLanes = new Set(policy.blocking_lanes ?? []);
  const acknowledgements = acknowledgementMap(policy.acknowledged_gaps ?? []);
  const manifestGaps = input.manifest.coverage?.gaps_requiring_user_selected_capabilities ?? [];
  const laneNames = new Set<string>([
    ...manifestGaps.map((gap) => gap.lane),
    ...blockingLanes,
    ...acknowledgements.keys(),
    ...input.playbook.stages.flatMap((stage) =>
      stage.steps.flatMap((step) => (step.coverage_lanes ?? []).map((assignment) => assignment.lane))
    )
  ]);

  const baselineByLane = new Map<string, "UNASSIGNED" | "PARTIAL">(
    manifestGaps.map((gap) => [gap.lane, normalizeManifestStatus(gap.status)])
  );
  const stepStateById = new Map(
    input.state.stages.flatMap((stage) => stage.steps.map((step) => [step.id, step] as const))
  );

  const lanes: CoverageLaneState[] = [...laneNames].sort().map((lane) => {
    let status: "UNASSIGNED" | CoverageLaneStatus = baselineByLane.get(lane) ?? "UNASSIGNED";
    const assignedCapabilities = new Set<string>();

    for (const stage of input.playbook.stages) {
      for (const step of stage.steps) {
        const assignments = (step.coverage_lanes ?? []).filter((assignment) => assignment.lane === lane);
        if (assignments.length === 0) continue;

        const stepState = stepStateById.get(step.id);
        if (stepState && excludedStatuses.has(stepState.status)) continue;

        assignedCapabilities.add(step.capability.id);
        for (const assignment of assignments) {
          status = strongestStatus(status, assignment.status);
        }
      }
    }

    const acknowledgement = acknowledgements.get(lane);
    return {
      lane,
      status,
      assigned_capabilities: [...assignedCapabilities].sort(),
      blocking: blockingLanes.has(lane),
      ...(acknowledgement ? { acknowledged_by: acknowledgement.acknowledged_by } : {})
    };
  });

  const blockingUnassignedLanes = lanes
    .filter((lane) => lane.blocking && lane.status !== "ASSIGNED")
    .map((lane) => lane.lane);

  return {
    lanes,
    blocking_unassigned_lanes: blockingUnassignedLanes,
    ...(blockingUnassignedLanes.length > 0
      ? { readiness_cap: policy.unassigned_lane_readiness_cap ?? "CONDITIONALLY_READY" }
      : {})
  };
}

export interface CoverageDeclarationInput {
  lane: string;
  assignedModule: string | null;
  rationale: string;
}

export interface CoverageGapsResult {
  hasUnassignedGaps: boolean;
  unassignedLanes: string[];
  readinessScoreCap: number;
  warnings: string[];
}

export function evaluateCoverageGaps(declarations: CoverageDeclarationInput[]): CoverageGapsResult {
  const unassignedLanes: string[] = [];
  const warnings: string[] = [];

  for (const decl of declarations) {
    if (!decl.assignedModule) {
      unassignedLanes.push(decl.lane);
      warnings.push(`Coverage gap in lane '${decl.lane}': ${decl.rationale}`);
    }
  }

  const hasUnassignedGaps = unassignedLanes.length > 0;
  const readinessScoreCap = hasUnassignedGaps ? 85 : 100;

  return {
    hasUnassignedGaps,
    unassignedLanes,
    readinessScoreCap,
    warnings,
  };
}

