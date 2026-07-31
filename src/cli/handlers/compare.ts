import { compareDokionRuns, type DokionRunSummary, type RunComparisonResult } from "../../report/compare-runs.ts";
import { StateStore } from "../../state/state-store.ts";

export interface CompareCommandOptions {
  baselineRunId?: string | undefined;
  targetRunId?: string | undefined;
}

export async function handleCompareCommand(
  root: string,
  options: CompareCommandOptions = {}
): Promise<RunComparisonResult> {
  const store = new StateStore(root);
  
  let currentRun: DokionRunSummary = {
    runId: "run-current",
    commit: "head",
    status: "UNKNOWN",
    findings: [],
    gates: []
  };

  if (await store.exists()) {
    const state = await store.load();
    currentRun = {
      runId: state.run.id,
      commit: state.baseline?.commit ?? "head",
      status: state.run.status,
      findings: state.stages.flatMap((s) => s.steps.flatMap((step) => (step.findings ?? []).map((f) => ({ id: f, severity: "HIGH", status: "OPEN" })))),
      gates: (state.release_gates ?? []).map((g) => ({ gateId: g.id, status: g.status }))
    };
  }

  const baselineRun: DokionRunSummary = {
    runId: options.baselineRunId ?? "baseline-run",
    commit: "baseline",
    status: "PASSED",
    findings: [],
    gates: []
  };

  const targetRun: DokionRunSummary = options.targetRunId
    ? { runId: options.targetRunId, commit: "target", status: "PASSED", findings: [], gates: [] }
    : currentRun;

  return compareDokionRuns(baselineRun, targetRun);
}
