import type { NormalizedFinding } from "../findings/types.ts";
import type { DokionPlaybook, PlaybookStep } from "../playbook/types.ts";
import type { DokionState, StepState } from "../state/types.ts";

export const COMPLETION_EVALUATOR_VERSION = "1.0.0" as const;

export const COMPLETION_CRITERIA = [
  "all_required_steps_succeeded",
  "all_verification_commands_passed",
  "all_release_gates_passed",
  "no_blocking_findings_open",
  "required_approvals_recorded",
  "declared_manual_reviews_complete",
  "results_tied_to_commit",
  "capability_manifest_reported",
  "execution_order_reported",
  "skipped_steps_reported",
  "unapplied_recommendations_reported",
  "playbook_digest_stable",
  "no_unacknowledged_blocking_lane",
  "readiness_statement_qualified"
] as const;

export type CompletionCriterionId = (typeof COMPLETION_CRITERIA)[number];
export type CompletionCriterionStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_APPLICABLE";
export type CompletionFreshness = "FRESH" | "STALE" | "UNKNOWN";

export interface CompletionCriterionResult {
  id: CompletionCriterionId;
  status: CompletionCriterionStatus;
  required: true;
  evaluator_version: typeof COMPLETION_EVALUATOR_VERSION;
  evaluated_at: string;
  freshness: CompletionFreshness;
  evidence: string[];
  reason?: string;
}

export interface CompletionEvaluation extends Record<string, unknown> {
  schema_version: 1;
  evaluator_version: typeof COMPLETION_EVALUATOR_VERSION;
  evaluated_at: string;
  claimed: boolean;
  claimed_at?: string;
  final_commit?: string;
  criteria: CompletionCriterionResult[];
  missing_required: CompletionCriterionId[];
  failing_required: CompletionCriterionId[];
}

export interface CompletionReportEvidence {
  capability_manifest_reported: readonly string[];
  execution_order_reported: readonly string[];
  skipped_steps_reported: readonly string[];
  unapplied_recommendations_reported: readonly string[];
  readiness_statement_qualified: readonly string[];
}

export interface CompletionEvaluationInput {
  state: DokionState;
  playbook: DokionPlaybook;
  findings: readonly NormalizedFinding[];
  reportEvidence: CompletionReportEvidence;
  currentCommit: string;
  currentPlaybookDigest: string;
  evaluatedAt: string;
}

const terminalStepStatuses = new Set(["SUCCEEDED", "SKIPPED_INAPPLICABLE"]);
const closedFindingStatuses = new Set<NormalizedFinding["status"]>([
  "VERIFIED", "FALSE_POSITIVE", "ACCEPTED_RISK", "DEFERRED", "NOT_APPLICABLE"
]);

function stateSteps(state: DokionState): Map<string, StepState> {
  return new Map(state.stages.flatMap((stage) => stage.steps.map((step) => [step.id, step] as const)));
}

function declaredSteps(playbook: DokionPlaybook): PlaybookStep[] {
  return playbook.stages.flatMap((stage) => stage.steps);
}

function criterion(
  id: CompletionCriterionId,
  passed: boolean,
  evaluatedAt: string,
  evidence: readonly string[],
  reason: string
): CompletionCriterionResult {
  return {
    id,
    status: passed ? "PASS" : "FAIL",
    required: true,
    evaluator_version: COMPLETION_EVALUATOR_VERSION,
    evaluated_at: evaluatedAt,
    freshness: "FRESH",
    evidence: evidence.length > 0 ? [...new Set(evidence)].sort() : [".dokion/state.json"],
    ...(!passed ? { reason } : {})
  };
}

function reportCriterion(
  id: Extract<CompletionCriterionId,
    | "capability_manifest_reported"
    | "execution_order_reported"
    | "skipped_steps_reported"
    | "unapplied_recommendations_reported"
    | "readiness_statement_qualified">,
  evidence: readonly string[],
  evaluatedAt: string,
  required: boolean
): CompletionCriterionResult {
  return criterion(
    id,
    !required || evidence.length > 0,
    evaluatedAt,
    evidence,
    `Required report evidence is missing for ${id}`
  );
}

function evidenceFromSteps(steps: readonly StepState[]): string[] {
  return steps.flatMap((step) => [
    ...(step.evidence ?? []),
    ...(step.verification_results ?? []).flatMap((result) => result.artifact ? [result.artifact] : [])
  ]);
}

export function evaluateCompletion(input: CompletionEvaluationInput): CompletionEvaluation {
  const stepsById = stateSteps(input.state);
  const configuredSteps = declaredSteps(input.playbook);
  const requiredSteps = configuredSteps.filter((step) => step.required !== false);
  const requiredStepStates = requiredSteps.map((step) => stepsById.get(step.id));
  const stepEvidence = evidenceFromSteps(requiredStepStates.filter((step): step is StepState => step !== undefined));

  const requiredStepsSucceeded = input.state.run.status === "COMPLETED" && requiredStepStates.every(
    (step) => step !== undefined && terminalStepStatuses.has(step.status)
  );
  const verificationPassed = configuredSteps.every((step) => {
    const commands = step.verification ?? [];
    if (commands.length === 0) return true;
    const results = stepsById.get(step.id)?.verification_results ?? [];
    return results.length >= commands.length && results.every((result) => result.exit_code === 0);
  });
  const gatesById = new Map((input.state.release_gates ?? []).map((gate) => [gate.id, gate] as const));
  const allReleaseGatesPassed = (input.playbook.release_gates ?? [])
    .every((gate) => gatesById.get(gate.id)?.status === "PASS");
  const blockingFindings = input.findings.filter(
    (finding) => finding.blocks_release && !closedFindingStatuses.has(finding.status)
  );
  const approvalsRecorded = configuredSteps.every((step) => {
    if (step.approval === undefined || step.approval === "NEVER") return true;
    return stepsById.get(step.id)?.approval?.granted === true;
  });
  const manualSteps = configuredSteps.filter((step) => step.capability.type === "manual");
  const manualReviewsComplete = manualSteps.every((step) => {
    const current = stepsById.get(step.id);
    return current !== undefined && terminalStepStatuses.has(current.status);
  });

  const resultsTiedToCommit = input.state.baseline?.commit === input.currentCommit
    && input.state.repository_identity.commit === input.currentCommit;
  const playbookStable = input.state.run.status !== "TAINTED"
    && input.state.playbook.tainted === undefined
    && input.state.playbook.digest === input.currentPlaybookDigest;
  const blockingCoverageComplete = (input.state.coverage ?? [])
    .filter((lane) => lane.blocking)
    .every((lane) => lane.status === "ASSIGNED" || lane.acknowledged_by !== undefined);
  const skippedStepsExist = [...stepsById.values()].some((step) => step.status.startsWith("SKIPPED_"));
  const suggestionsExist = (input.state.suggestions ?? []).length > 0;

  const criteria: CompletionCriterionResult[] = [
    criterion("all_required_steps_succeeded", requiredStepsSucceeded, input.evaluatedAt, stepEvidence,
      "A required step is incomplete or the run is not completed"),
    criterion("all_verification_commands_passed", verificationPassed, input.evaluatedAt, stepEvidence,
      "A declared verification command is missing or failed"),
    criterion("all_release_gates_passed", allReleaseGatesPassed, input.evaluatedAt,
      (input.state.release_gates ?? []).flatMap((gate) => gate.artifact ? [gate.artifact] : []),
      "A blocking release gate is missing or failed"),
    criterion("no_blocking_findings_open", blockingFindings.length === 0, input.evaluatedAt,
      blockingFindings.flatMap((finding) => finding.evidence.map((item) => item.path)),
      "A release-blocking finding remains open"),
    criterion("required_approvals_recorded", approvalsRecorded, input.evaluatedAt, [".dokion/state.json#/approvals"],
      "A declared approval is missing"),
    criterion("declared_manual_reviews_complete", manualReviewsComplete, input.evaluatedAt, stepEvidence,
      "A declared manual review is incomplete"),
    criterion("results_tied_to_commit", resultsTiedToCommit, input.evaluatedAt, [".dokion/state.json#/repository_identity"],
      "Results are not tied to the evaluated commit"),
    reportCriterion("capability_manifest_reported", input.reportEvidence.capability_manifest_reported,
      input.evaluatedAt, true),
    reportCriterion("execution_order_reported", input.reportEvidence.execution_order_reported,
      input.evaluatedAt, true),
    reportCriterion("skipped_steps_reported", input.reportEvidence.skipped_steps_reported,
      input.evaluatedAt, skippedStepsExist),
    reportCriterion("unapplied_recommendations_reported", input.reportEvidence.unapplied_recommendations_reported,
      input.evaluatedAt, suggestionsExist),
    criterion("playbook_digest_stable", playbookStable, input.evaluatedAt, [".dokion/state.json#/playbook"],
      "The playbook digest is stale or tainted"),
    criterion("no_unacknowledged_blocking_lane", blockingCoverageComplete, input.evaluatedAt,
      [".dokion/state.json#/coverage"], "A blocking coverage lane is unassigned and unacknowledged"),
    reportCriterion("readiness_statement_qualified", input.reportEvidence.readiness_statement_qualified,
      input.evaluatedAt, true)
  ];

  const stale = input.state.baseline?.commit !== input.currentCommit
    || input.state.playbook.digest !== input.currentPlaybookDigest;
  if (stale) {
    for (const result of criteria) {
      result.status = "BLOCKED";
      result.freshness = "STALE";
      result.reason = "Completion evidence does not match the evaluated commit or playbook digest";
    }
  }

  const byId = new Map(criteria.map((result) => [result.id, result] as const));
  const missingRequired = COMPLETION_CRITERIA.filter((id) => !byId.has(id));
  const failingRequired = criteria
    .filter((result) => result.status === "FAIL" || result.status === "BLOCKED")
    .map((result) => result.id)
    .sort();
  const claimed = missingRequired.length === 0 && failingRequired.length === 0;

  return {
    schema_version: 1,
    evaluator_version: COMPLETION_EVALUATOR_VERSION,
    evaluated_at: input.evaluatedAt,
    claimed,
    ...(claimed ? { claimed_at: input.evaluatedAt, final_commit: input.currentCommit } : {}),
    criteria,
    missing_required: missingRequired,
    failing_required: failingRequired
  };
}
