import { evaluateApplicability } from "../applicability/evaluate-applicability.ts";
import { inspectProject, type ProjectProfile } from "../inspect/project-inspector.ts";
import { detectAgentPlatform } from "../platform/platform-detector.ts";
import type {
  ApprovalPolicy,
  FailurePolicy,
  InapplicablePolicy,
  PlaybookStage,
  PlaybookStep
} from "../playbook/types.ts";
import { ACTIVE_PLAYBOOK_PATH, loadActivePlaybook } from "../playbook/load-playbook.ts";

export type PlanDisposition = "RUN" | "SKIPPED_INAPPLICABLE" | "BLOCKED" | "STOPPED_BY_POLICY";

export interface PlanPrediction {
  applicable: boolean;
  disposition: PlanDisposition;
  reason: string;
}

export interface PlannedPermissions {
  read: string[];
  write: string[];
  network: boolean | string[];
  shell: string[];
  env: string[];
}

export interface PlannedStep {
  order: number;
  id: string;
  name?: string;
  responsibility: string;
  capability: PlaybookStep["capability"];
  mode: PlaybookStep["mode"];
  required: boolean;
  depends_on: string[];
  approval: ApprovalPolicy;
  failure_policy: FailurePolicy;
  retry_count: number;
  maximum_iterations: number;
  timeout_seconds?: number;
  permissions: PlannedPermissions;
  prediction: PlanPrediction;
  verification: string[];
  success_conditions: string[];
  stop_conditions: string[];
  coverage_lanes: NonNullable<PlaybookStep["coverage_lanes"]>;
}

export interface PlannedStage {
  order: number;
  id: string;
  name?: string;
  execution: PlaybookStage["execution"];
  depends_on: string[];
  prediction: PlanPrediction;
  steps: PlannedStep[];
}

export interface ExecutionPlan {
  version: 1;
  playbook: {
    path: string;
    digest: string;
    version: string;
    project: string;
    target?: string;
  };
  platform: ReturnType<typeof detectAgentPlatform>;
  profile: Omit<ProjectProfile, "detected_at">;
  stages: PlannedStage[];
  release_gates: NonNullable<Awaited<ReturnType<typeof loadActivePlaybook>>["data"]["release_gates"]>;
  coverage_policy?: Awaited<ReturnType<typeof loadActivePlaybook>>["data"]["coverage_policy"];
}

function disposition(applicable: boolean, policy: InapplicablePolicy | undefined): PlanDisposition {
  if (applicable) return "RUN";
  if (policy === "MARK_BLOCKED") return "BLOCKED";
  if (policy === "STOP_STAGE") return "STOPPED_BY_POLICY";
  return "SKIPPED_INAPPLICABLE";
}

function permissions(step: PlaybookStep): PlannedPermissions {
  return {
    read: [...(step.permissions?.read ?? [])],
    write: [...(step.permissions?.write ?? [])],
    network: Array.isArray(step.permissions?.network)
      ? [...step.permissions.network]
      : step.permissions?.network ?? false,
    shell: [...(step.permissions?.shell ?? [])],
    env: [...(step.permissions?.env ?? [])]
  };
}

function inheritedStepPrediction(stage: PlaybookStage, prediction: PlanPrediction): PlanPrediction {
  return {
    applicable: false,
    disposition: prediction.disposition,
    reason: `stage ${stage.id} is inapplicable: ${prediction.reason}`
  };
}

async function planStep(input: {
  root: string;
  platform: ReturnType<typeof detectAgentPlatform>["agent"];
  profile: ProjectProfile;
  stage: PlaybookStage;
  stagePrediction: PlanPrediction;
  step: PlaybookStep;
  order: number;
  defaults: {
    approval?: ApprovalPolicy;
    failure_policy?: FailurePolicy;
    retry_count?: number;
    maximum_iterations?: number;
  } | undefined;
}): Promise<PlannedStep> {
  let prediction: PlanPrediction;
  if (!input.stagePrediction.applicable) {
    prediction = inheritedStepPrediction(input.stage, input.stagePrediction);
  } else {
    const result = await evaluateApplicability({
      root: input.root,
      platform: input.platform,
      profile: input.profile,
      applicability: input.step.applicability
    });
    prediction = {
      applicable: result.applicable,
      disposition: disposition(result.applicable, input.step.applicability?.on_inapplicable),
      reason: result.reason
    };
  }

  return {
    order: input.order,
    id: input.step.id,
    ...(input.step.name ? { name: input.step.name } : {}),
    responsibility: input.step.responsibility,
    capability: {
      ...input.step.capability,
      ...(input.step.capability.platforms ? { platforms: { ...input.step.capability.platforms } } : {})
    },
    mode: input.step.mode,
    required: input.step.required ?? false,
    depends_on: [...(input.step.depends_on ?? [])],
    approval: input.step.approval ?? input.defaults?.approval ?? "BEFORE_WRITE",
    failure_policy: input.step.failure_policy ?? input.defaults?.failure_policy ?? "STOP_STAGE",
    retry_count: input.step.retry_count ?? input.defaults?.retry_count ?? 0,
    maximum_iterations: input.step.maximum_iterations ?? input.defaults?.maximum_iterations ?? 1,
    ...(input.step.timeout_seconds !== undefined ? { timeout_seconds: input.step.timeout_seconds } : {}),
    permissions: permissions(input.step),
    prediction,
    verification: [...(input.step.verification ?? [])],
    success_conditions: [...(input.step.success_conditions ?? [])],
    stop_conditions: [...(input.step.stop_conditions ?? [])],
    coverage_lanes: (input.step.coverage_lanes ?? []).map((lane) => ({ ...lane }))
  };
}

async function planStage(input: {
  root: string;
  platform: ReturnType<typeof detectAgentPlatform>["agent"];
  profile: ProjectProfile;
  stage: PlaybookStage;
  order: number;
  defaults: Parameters<typeof planStep>[0]["defaults"];
}): Promise<PlannedStage> {
  const result = await evaluateApplicability({
    root: input.root,
    platform: input.platform,
    profile: input.profile,
    applicability: input.stage.applicability
  });
  const prediction: PlanPrediction = {
    applicable: result.applicable,
    disposition: disposition(result.applicable, input.stage.applicability?.on_inapplicable),
    reason: result.reason
  };
  const steps: PlannedStep[] = [];
  for (const [index, step] of input.stage.steps.entries()) {
    steps.push(await planStep({
      root: input.root,
      platform: input.platform,
      profile: input.profile,
      stage: input.stage,
      stagePrediction: prediction,
      step,
      order: index + 1,
      defaults: input.defaults
    }));
  }

  return {
    order: input.order,
    id: input.stage.id,
    ...(input.stage.name ? { name: input.stage.name } : {}),
    execution: input.stage.execution,
    depends_on: [...(input.stage.depends_on ?? [])],
    prediction,
    steps
  };
}

export async function renderExecutionPlan(
  root: string,
  environment: NodeJS.ProcessEnv = process.env
): Promise<ExecutionPlan> {
  const loaded = await loadActivePlaybook(root);
  const [profile, platform] = await Promise.all([
    inspectProject(root),
    Promise.resolve(detectAgentPlatform(environment))
  ]);
  const stages: PlannedStage[] = [];
  for (const [index, stage] of loaded.data.stages.entries()) {
    stages.push(await planStage({
      root,
      platform: platform.agent,
      profile,
      stage,
      order: index + 1,
      defaults: loaded.data.defaults
    }));
  }
  const { detected_at: _detectedAt, ...stableProfile } = profile;

  return {
    version: 1,
    playbook: {
      path: ACTIVE_PLAYBOOK_PATH,
      digest: loaded.digest,
      version: loaded.data.version,
      project: loaded.data.project.name,
      ...(loaded.data.project.target ? { target: loaded.data.project.target } : {})
    },
    platform,
    profile: stableProfile,
    stages,
    release_gates: (loaded.data.release_gates ?? []).map((gate) => ({ ...gate })),
    ...(loaded.data.coverage_policy
      ? {
          coverage_policy: {
            ...loaded.data.coverage_policy,
            blocking_lanes: [...(loaded.data.coverage_policy.blocking_lanes ?? [])],
            acknowledged_gaps: (loaded.data.coverage_policy.acknowledged_gaps ?? []).map((gap) => ({ ...gap }))
          }
        }
      : {})
  };
}
