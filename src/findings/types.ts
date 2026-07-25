export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type FindingStatus =
  | "OPEN"
  | "VALIDATING"
  | "APPROVED_FOR_FIX"
  | "FIXING"
  | "FIXED_PENDING_VERIFICATION"
  | "VERIFIED"
  | "REPAIR_REJECTED"
  | "FALSE_POSITIVE"
  | "ACCEPTED_RISK"
  | "DEFERRED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export interface FindingEvidence {
  kind: "tool_output" | "log" | "screenshot" | "trace" | "report" | "diff" | "test_result" | "metric";
  path: string;
  digest?: string;
  captured_at?: string;
  phase?: "BEFORE" | "AFTER";
}

export interface FindingLocation {
  file?: string;
  line?: number;
  end_line?: number;
  symbol?: string;
  url?: string;
}

export interface ProposedFix {
  summary?: string;
  rationale?: string;
  risk?: "LOW" | "MEDIUM" | "HIGH";
  effort?: "TRIVIAL" | "SMALL" | "MEDIUM" | "LARGE";
  touches_files?: string[];
}

export interface NormalizedFinding {
  id: string;
  step_id: string;
  stage_id?: string;
  severity: FindingSeverity;
  title: string;
  description?: string;
  source: {
    capability_id: string;
    capability_version?: string;
    rule_id?: string;
    raw_artifact?: string;
  };
  location?: FindingLocation;
  evidence: FindingEvidence[];
  proposed_fix?: ProposedFix;
  status: FindingStatus;
  resolution?: {
    commit?: string;
    diff_artifact?: string;
    regression_test?: string;
    verified_by?: string[];
    adversary_verdict?: "FIX_HOLDS" | "FIX_IS_SUPPRESSION" | "FIX_INCOMPLETE" | "NOT_RUN";
    resolved_at?: string;
  };
  blocks_release?: boolean;
  first_seen_run?: string;
  tags?: string[];
}

export interface RawFinding {
  severity: FindingSeverity;
  title: string;
  description?: string;
  rule_id?: string;
  location?: FindingLocation;
  proposed_fix?: ProposedFix;
  blocks_release?: boolean;
  tags?: string[];
}

export interface RawFindingEnvelope {
  version: 1;
  findings: RawFinding[];
}
