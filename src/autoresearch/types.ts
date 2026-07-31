export type GoalArchetype =
  | "ship-ready"
  | "optimize-metric"
  | "fix-broken"
  | "harden"
  | "build-feature"
  | "explore"
  | "document"
  | "what-to-build"
  | "decide-design";

export type AutoresearchMode = "classic" | "orchestrator" | "wizard";

export type ExecutionHop =
  | "plan"
  | "debug"
  | "fix"
  | "security"
  | "ship"
  | "scenario"
  | "predict"
  | "learn"
  | "reason"
  | "probe"
  | "improve"
  | "evals"
  | "regression"
  | "verify";

export type HopOutcomeStatus = "progressed" | "no-op" | "failed" | "blocked";

export interface SuccessPredicate {
  command: string;
  expectedOutput?: string;
  expectedExitCode?: number;
  comparison?: "exact" | "contains" | "numeric_min" | "numeric_max";
  targetValue?: number;
}

export interface PipelineHopLog {
  hop: ExecutionHop;
  outcome: HopOutcomeStatus;
  unitsBefore: number;
  unitsAfter: number;
  timestamp: string;
}

export interface AutoresearchState {
  goal: string;
  archetype: GoalArchetype;
  mode: "loop" | "dispatch";
  predicate: SuccessPredicate;
  cycleCount: number;
  maxCycles: number;
  unitsRemaining: number;
  unitsHistory: number[];
  pipelineLog: PipelineHopLog[];
  status: "RUNNING" | "CONVERGED" | "PLATEAU" | "CEILING" | "BLOCKED";
}

export interface AutoresearchIterationConfig {
  goal: string;
  metricCommand?: string;
  guardCommand?: string;
  targetMetricValue?: number;
  maxIterations?: number;
  allowUnlimited?: boolean;
}

export interface AutoresearchIterationStepResult {
  iteration: number;
  changeDescription: string;
  verifyPassed: boolean;
  guardPassed: boolean;
  metricValue?: number;
  action: "KEEP" | "ROLLBACK";
  durationMs: number;
}

export interface AutoresearchRunSummary {
  goal: string;
  archetype: GoalArchetype;
  status: "CONVERGED" | "PLATEAU" | "CEILING" | "BLOCKED" | "COMPLETED";
  totalIterations: number;
  keptChanges: number;
  rolledBackChanges: number;
  finalMetricValue?: number;
  completionPercentage: number;
  message: string;
}
