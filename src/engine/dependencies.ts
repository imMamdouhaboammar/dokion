import { DokionError } from "../core/errors.ts";
import type { DokionPlaybook, PlaybookStage, PlaybookStep } from "../playbook/types.ts";
import type { DokionState } from "../state/types.ts";

function completedStageIds(state: DokionState): Set<string> {
  return new Set(state.stages.filter((stage) => stage.status === "SUCCEEDED").map((stage) => stage.id));
}

function completedStepIds(state: DokionState): Set<string> {
  return new Set(
    state.stages.flatMap((stage) => stage.steps.filter((step) => step.status === "SUCCEEDED").map((step) => step.id))
  );
}

export function assertStageDependencies(stage: PlaybookStage, state: DokionState): void {
  const completed = completedStageIds(state);
  const unmet = (stage.depends_on ?? []).filter((dependency) => !completed.has(dependency));
  if (unmet.length > 0) {
    throw new DokionError("DEPENDENCY_UNMET", `Stage ${stage.id} has unmet dependencies`, {
      stageId: stage.id,
      unmet
    });
  }
}

export function assertStepDependencies(step: PlaybookStep, state: DokionState): void {
  const completed = completedStepIds(state);
  const unmet = (step.depends_on ?? []).filter((dependency) => !completed.has(dependency));
  if (unmet.length > 0) {
    throw new DokionError("DEPENDENCY_UNMET", `Step ${step.id} has unmet dependencies`, {
      stepId: step.id,
      unmet
    });
  }
}

export function assertSequentialExecution(playbook: DokionPlaybook): void {
  const parallelStages = playbook.stages.filter((stage) => stage.execution !== "SEQUENTIAL").map((stage) => stage.id);
  if (parallelStages.length > 0) {
    throw new DokionError(
      "UNSUPPORTED_EXECUTION",
      "M0-M2 supports only explicitly sequential stages; parallel execution requires worktree isolation in a later milestone",
      { parallelStages }
    );
  }
}
