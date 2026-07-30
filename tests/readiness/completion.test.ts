import { describe, expect, test } from "bun:test";

import { validateStateData } from "../../src/contracts/schema-validator.ts";
import type { NormalizedFinding } from "../../src/findings/types.ts";
import type { DokionPlaybook } from "../../src/playbook/types.ts";
import { evaluateCompletion } from "../../src/readiness/completion.ts";
import type { DokionState } from "../../src/state/types.ts";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function playbook(): DokionPlaybook {
  return {
    version: "1.0.0",
    project: { name: "completion", target: "READY_FOR_PRODUCTION" },
    authority: { capability_selection: "USER_ONLY", execution_order: "USER_ONLY" },
    stages: [{
      id: "verify",
      execution: "SEQUENTIAL",
      steps: [{
        id: "required-step",
        capability: { type: "command", id: "check", immutable_reference: digest("a") },
        responsibility: "Run a required check.",
        mode: "VERIFY_ONLY",
        required: true,
        approval: "BEFORE_EXECUTION",
        verification: ["bun test"]
      }]
    }],
    release_gates: [{ id: "gate", condition: "required_steps_complete == true", blocking: true }],
    coverage_policy: { blocking_lanes: ["application-security"] }
  };
}

function state(): DokionState {
  return {
    schema_version: 1,
    revision: 4,
    run: { id: "run-completion", started_at: "2026-07-30T18:00:00.000Z", status: "COMPLETED" },
    repository_identity: {
      schema_version: 1,
      kind: "git",
      canonical_root: "/fixture",
      root_digest: digest("1"),
      worktree_id: digest("2"),
      playbook_digest: digest("3"),
      captured_at: "2026-07-30T18:00:00.000Z",
      commit: COMMIT
    },
    playbook: {
      path: ".dokion/playbook.json",
      digest: digest("3"),
      verified_at: "2026-07-30T18:00:00.000Z"
    },
    baseline: { commit: COMMIT, branch: "main", worktree_clean: true },
    stages: [{
      id: "verify",
      status: "SUCCEEDED",
      steps: [{
        id: "required-step",
        status: "SUCCEEDED",
        approval: { policy: "BEFORE_EXECUTION", granted: true, granted_by: "mamdouh" },
        verification_results: [{ command: "bun test", exit_code: 0, artifact: ".dokion/evidence/test.json" }],
        evidence: [".dokion/evidence/test.json"]
      }]
    }],
    release_gates: [{ id: "gate", status: "PASS", blocking: true, artifact: ".dokion/evidence/gate.json" }],
    coverage: [{ lane: "application-security", status: "ASSIGNED", blocking: true }],
    suggestions: []
  };
}

function reportEvidence() {
  return {
    capability_manifest_reported: ["HARDENING.md#declared-capabilities"],
    execution_order_reported: ["HARDENING.md#declared-execution-order"],
    skipped_steps_reported: ["HARDENING.md#exceptions"],
    unapplied_recommendations_reported: ["HARDENING.md#suggested-playbook-changes"],
    readiness_statement_qualified: ["HARDENING.md#readiness-statement"]
  };
}

describe("completion criterion evaluation", () => {
  test("records every criterion with evidence, freshness, and a schema-valid claim", async () => {
    const current = state();
    const result = evaluateCompletion({
      state: current,
      playbook: playbook(),
      findings: [],
      reportEvidence: reportEvidence(),
      currentCommit: COMMIT,
      currentPlaybookDigest: digest("3"),
      evaluatedAt: "2026-07-30T19:00:00.000Z"
    });

    expect(result.claimed).toBe(true);
    expect(result.criteria).toHaveLength(14);
    expect(result.criteria.every((criterion) => criterion.status === "PASS")).toBe(true);
    expect(result.criteria.every((criterion) => criterion.evaluator_version === "1.0.0")).toBe(true);
    expect(result.criteria.every((criterion) => criterion.freshness === "FRESH")).toBe(true);
    expect(result.criteria.every((criterion) => criterion.evidence.length > 0)).toBe(true);
    expect(result.missing_required).toEqual([]);
    expect(result.failing_required).toEqual([]);

    current.completion = result;
    expect(await validateStateData(process.cwd(), current)).toEqual([]);
  });

  test("fails closed for blocking findings and missing report evidence", () => {
    const blockingFinding: NormalizedFinding = {
      id: "DK-SEC-001",
      step_id: "required-step",
      severity: "HIGH",
      title: "Blocking finding",
      source: { capability_id: "check" },
      evidence: [{ kind: "report", path: ".dokion/evidence/finding.json" }],
      status: "OPEN",
      blocks_release: true
    };
    const evidence = reportEvidence();
    evidence.capability_manifest_reported = [];

    const result = evaluateCompletion({
      state: state(),
      playbook: playbook(),
      findings: [blockingFinding],
      reportEvidence: evidence,
      currentCommit: COMMIT,
      currentPlaybookDigest: digest("3"),
      evaluatedAt: "2026-07-30T19:00:00.000Z"
    });

    expect(result.claimed).toBe(false);
    expect(result.failing_required).toEqual([
      "capability_manifest_reported",
      "no_blocking_findings_open"
    ]);
  });

  test("requires every configured release gate to pass", () => {
    const configuredPlaybook = playbook();
    configuredPlaybook.release_gates![0]!.blocking = false;
    const current = state();
    current.release_gates![0]!.status = "FAIL";

    const result = evaluateCompletion({
      state: current,
      playbook: configuredPlaybook,
      findings: [],
      reportEvidence: reportEvidence(),
      currentCommit: COMMIT,
      currentPlaybookDigest: digest("3"),
      evaluatedAt: "2026-07-30T19:00:00.000Z"
    });

    expect(result.criteria.find((criterion) => criterion.id === "all_release_gates_passed")?.status).toBe("FAIL");
    expect(result.claimed).toBe(false);
  });

  test("blocks completion when the evaluated evidence is stale", () => {
    const result = evaluateCompletion({
      state: state(),
      playbook: playbook(),
      findings: [],
      reportEvidence: reportEvidence(),
      currentCommit: "fedcba9876543210",
      currentPlaybookDigest: digest("3"),
      evaluatedAt: "2026-07-30T19:00:00.000Z"
    });

    expect(result.claimed).toBe(false);
    expect(result.criteria.every((criterion) => criterion.freshness === "STALE")).toBe(true);
    expect(result.criteria.every((criterion) => criterion.status === "BLOCKED")).toBe(true);
    expect(result.failing_required).toEqual(result.criteria.map((criterion) => criterion.id).sort());
  });
});
