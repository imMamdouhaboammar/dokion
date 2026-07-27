import type { AgentPlatform, PlatformDegradation, PlatformProfile } from "../platform/types.ts";

export type RunStatus = "RUNNING" | "AWAITING_USER" | "COMPLETED" | "STOPPED" | "BLOCKED" | "FAILED" | "TAINTED";

export type ExecutionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "AWAITING_APPROVAL"
  | "SUCCEEDED"
  | "FAILED"
  | "BLOCKED"
  | "SKIPPED_INAPPLICABLE"
  | "SKIPPED_BY_USER"
  | "STOPPED_BY_POLICY";

export interface VerificationResult {
  command: string;
  exit_code: number;
  artifact?: string;
  ran_at?: string;
}

export interface ApprovalStateRecord {
  at: string;
  subject: string;
  subject_type?: "step" | "finding" | "fix" | "commit" | "install" | "suggestion" | "deferral";
  decision: "APPROVED" | "REJECTED" | "MODIFIED" | "DEFERRED";
  by?: string;
  notes?: string;
}

export interface CoverageLaneState {
  lane: string;
  status: "UNASSIGNED" | "PARTIAL" | "ASSIGNED";
  assigned_capabilities?: string[];
  blocking?: boolean;
  acknowledged_by?: string;
}

export interface ReleaseGateState {
  id: string;
  status: "PASS" | "FAIL" | "NOT_RUN" | "SKIPPED";
  blocking: boolean;
  evaluated?: string;
  exit_code?: number;
  artifact?: string;
  ran_at?: string;
}

export interface StepState {
  id: string;
  status: ExecutionStatus;
  mode?: string;
  attempts?: number;
  iterations?: number;
  started_at?: string;
  ended_at?: string;
  approval?: {
    policy?: string;
    granted?: boolean;
    granted_by?: string;
    granted_at?: string;
    scope?: string;
  };
  findings?: string[];
  verification_results?: VerificationResult[];
  success_conditions_met?: string[];
  success_conditions_unmet?: string[];
  evidence?: string[];
  commits?: string[];
  scope_violations?: Array<{
    attempted: string;
    declared_scope: string;
    blocked?: boolean;
    at?: string;
  }>;
  failure_reason?: string;
  applied_failure_policy?: string;
  skip_reason?: string;
}

export interface StageState {
  id: string;
  status: ExecutionStatus;
  started_at?: string;
  ended_at?: string;
  reason?: string;
  steps: StepState[];
}

export interface DokionState {
  $schema?: string;
  schema_version: 1;
  revision: number;
  run: {
    id: string;
    started_at: string;
    ended_at?: string;
    status: RunStatus;
    agent?: AgentPlatform;
    agent_version?: string;
    model?: string;
    resumed_from?: string;
    degradations?: PlatformDegradation[];
  };
  playbook: {
    path: string;
    digest_algorithm?: "sha256" | "sha512";
    digest: string;
    verified_at: string;
    last_verified_before_step?: string;
    tainted?: {
      expected: string;
      observed: string;
      detected_at: string;
      detected_before_step?: string;
    };
  };
  baseline?: {
    commit?: string;
    branch?: string;
    worktree_clean?: boolean;
    captured_at?: string;
  };
  profile?: {
    platform?: PlatformProfile;
    [key: string]: unknown;
  };
  capabilities?: Array<Record<string, unknown>>;
  stages: StageState[];
  findings_index?: Record<string, unknown>;
  approvals?: ApprovalStateRecord[];
  release_gates?: ReleaseGateState[];
  suggestions?: Array<Record<string, unknown>>;
  completion?: Record<string, unknown>;
  log?: Array<{ at: string; event: string; step_id?: string; detail?: string }>;
  release_readiness?: Record<string, unknown>;
  coverage?: CoverageLaneState[];
  events_log?: string;
}

export interface StateInitialization {
  runId?: string;
  playbookDigest: string;
  commitSha?: string;
  branch?: string;
  worktreeClean?: boolean;
  platform?: PlatformProfile;
  agent?: AgentPlatform;
  profile?: Record<string, unknown>;
  stages: Array<{
    id: string;
    steps: Array<{ id: string; mode?: string }>;
  }>;
}
