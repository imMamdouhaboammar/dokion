export type ExecutionMode =
  | "READ_ONLY"
  | "ANALYZE"
  | "CONFIGURE"
  | "FIX_WITH_APPROVAL"
  | "FIX_AUTOMATICALLY"
  | "VERIFY_ONLY"
  | "REPORT_ONLY";

export type ApprovalPolicy =
  | "NEVER"
  | "FROM_PLAYBOOK"
  | "BEFORE_INSTALL"
  | "BEFORE_EXECUTION"
  | "BEFORE_WRITE"
  | "BEFORE_EACH_FIX"
  | "BEFORE_COMMIT"
  | "ALWAYS";

export type FailurePolicy =
  | "STOP_PIPELINE"
  | "STOP_STAGE"
  | "CONTINUE"
  | "REQUEST_USER_DECISION"
  | "MARK_BLOCKED";

export type DokionPlatform = "claude_code" | "codex" | "gemini_cli" | "other";
export type InapplicablePolicy = "SKIP" | "MARK_BLOCKED" | "STOP_STAGE";

export interface Applicability {
  when_paths_exist?: string[];
  when_paths_absent?: string[];
  when_platform?: Array<Exclude<DokionPlatform, "other">>;
  when_profile?: Record<string, boolean | string | unknown[]>;
  on_inapplicable?: InapplicablePolicy;
}

export interface ValidationPolicy {
  adversarial_verification?: boolean;
  suppression_detection?: boolean;
  require_regression_test?: boolean;
  require_evidence_artifact?: boolean;
  forbid_test_deletion?: boolean;
  forbid_out_of_scope_edits?: boolean;
  max_diff_lines?: number;
}

export interface CapabilityReference {
  type: string;
  id: string;
  workflow?: string;
  version?: string;
  source?: string;
  immutable_reference: string;
  platforms?: {
    claude_code?: string;
    codex?: string;
    gemini_cli?: string;
  };
}

export interface PlaybookStep {
  id: string;
  name?: string;
  capability: CapabilityReference;
  responsibility: string;
  mode: ExecutionMode;
  required?: boolean;
  depends_on?: string[];
  applicability?: Applicability;
  approval?: ApprovalPolicy;
  validation?: ValidationPolicy;
  verification?: string[];
  success_conditions?: string[];
  stop_conditions?: string[];
  failure_policy?: FailurePolicy;
  retry  maximum_iterations?: number;
  timeout_seconds?: number;
  permissions?: {
    read?: string[];
    write?: string[];
    network?: boolean | string[];
    shell?: string[];
    env?: string[];
  };
}

export interface PlaybookStage {
  id: string;
  name?: string;
  execution: "SEQUENTIAL" | "PARALLEL";
  depends_on?: string[];
  applicability?: Applicability;
  steps: PlaybookStep[];
}

export interface DokionPlaybook {
  $schema?: string;
  version: string;
  project: {
    name: string;
    target: "NOT_READY" | "CONDITIONALLY_READY" | "READY_FOR_STAGING" | "READY_FOR_PRODUCTION";
    notes?: string;
  };
  authority: Record<string, unknown>;
  enforcement: Record<string, unknown>;
  registry: Record<string, unknown>;
  defaults?: {
    approval?: ApprovalPolicy;
    failure_policy?: FailurePolicy;
    retry_count?: number;
    maximum_iterations?: number;
    parallel_execution?: boolean;
    validation?: ValidationPolicy;
  };
  stages: PlaybookStage[];
  release_gates?: Array<Record<string, unknown>>;
  manifest: string;
  [key: string]: unknown;
}

export interface LoadedPlaybook {
  path: string;
  digest: string;
  raw: string;
  data: DokionPlaybook;
}
