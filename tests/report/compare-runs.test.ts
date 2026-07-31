import { describe, test, expect } from "bun:test";
import { compareDokionRuns } from "../../src/report/compare-runs";

describe("EVID-009 Run Comparison Engine (dokion diff/compare)", () => {
  test("compares two Dokion run records deterministically without mutating state", () => {
    const runA = {
      runId: "run-001",
      commit: "abc1234",
      status: "PASSED",
      findings: [
        { id: "SEC-001", severity: "HIGH", status: "OPEN" },
      ],
      gates: [{ gateId: "PG-001", status: "PASS" }],
    };

    const runB = {
      runId: "run-002",
      commit: "def5678",
      status: "PASSED",
      findings: [
        { id: "SEC-001", severity: "HIGH", status: "RESOLVED" },
        { id: "PERF-001", severity: "MEDIUM", status: "NEW" },
      ],
      gates: [
        { gateId: "PG-001", status: "PASS" },
        { gateId: "PG-002", status: "PASS" },
      ],
    };

    const diff = compareDokionRuns(runA, runB);
    expect(diff.baselineRunId).toBe("run-001");
    expect(diff.targetRunId).toBe("run-002");
    expect(diff.resolvedFindings).toContain("SEC-001");
    expect(diff.newFindings).toContain("PERF-001");
    expect(diff.gateChanges).toHaveLength(1);
    expect(diff.isReadOnly).toBe(true);
  });
});
