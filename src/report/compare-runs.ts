export interface DokionRunSummary {
  runId: string;
  commit: string;
  status: string;
  findings: Array<{ id: string; severity: string; status: string }>;
  gates: Array<{ gateId: string; status: string }>;
}

export interface RunComparisonResult {
  baselineRunId: string;
  targetRunId: string;
  resolvedFindings: string[];
  newFindings: string[];
  gateChanges: Array<{ gateId: string; fromStatus: string; toStatus: string }>;
  isReadOnly: boolean;
}

export function compareDokionRuns(runA: DokionRunSummary, runB: DokionRunSummary): RunComparisonResult {
  const findingsA = new Map(runA.findings.map((f) => [f.id, f.status]));
  const findingsB = new Map(runB.findings.map((f) => [f.id, f.status]));

  const resolvedFindings: string[] = [];
  const newFindings: string[] = [];

  for (const [id, statusA] of findingsA.entries()) {
    const statusB = findingsB.get(id);
    if (statusA === "OPEN" && statusB === "RESOLVED") {
      resolvedFindings.push(id);
    }
  }

  for (const [id, statusB] of findingsB.entries()) {
    if (!findingsA.has(id) || statusB === "NEW") {
      newFindings.push(id);
    }
  }

  const gatesA = new Map(runA.gates.map((g) => [g.gateId, g.status]));
  const gatesB = new Map(runB.gates.map((g) => [g.gateId, g.status]));

  const gateChanges: Array<{ gateId: string; fromStatus: string; toStatus: string }> = [];

  for (const [gateId, statusB] of gatesB.entries()) {
    const statusA = gatesA.get(gateId) ?? "MISSING";
    if (statusA !== statusB) {
      gateChanges.push({ gateId, fromStatus: statusA, toStatus: statusB });
    }
  }

  return {
    baselineRunId: runA.runId,
    targetRunId: runB.runId,
    resolvedFindings,
    newFindings,
    gateChanges,
    isReadOnly: true,
  };
}
