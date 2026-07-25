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
  run: {
    id: string;
    started_at: string;
    ended_at?: string;
    status: RunStatus;
    agent?: "claude_code" | "codex" | "gemini_cli" | "other";
    agent_version?: string;
    model?: string;
    resumed_from?: string;
    degradations?: Array<"NO_HOOK_ENFORCEMENT" | "NO_SUBAGENT_ISOLATION" | "NO_PARALLEL_WRITES" | "NO_WORKTREE_ISOLATION">;
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
  profile?: Record<string, unknown>;
  capabilities?: Array<Record<string, unknown>>;
  stages: StageState[];
  findings_index?: Record<string, unknown>;
  approvals?: ApprovalStateRecord[];
  release_gates?: Array<Record<string, unknown>>;
  suggestions?: Array<Record<string, unknown>>;
  completion?: Record<string, unknown>;
  log?: Array<{ at: string; event: string; step_id?: string; detail?: string }>;
  release_readiness?: Record<string, unknown>;
  coverage?: Array<Record<string, unknown>>;
  events_log?: string;
}

export interface StateInitialization {
  playbookDigest: string;
  commitSha?: string;
  branch?: string;
  worktreeClean?: boolean;
  agent?: DokionState["run"]["agent"];
  profile?: Record<string, unknown>;
  stages: Array<{
    id: string;
    steps: Array<{ id: string; mode?: string }>;
  }>;
}
