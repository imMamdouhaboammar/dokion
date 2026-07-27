import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NormalizedFinding } from "../src/findings/types.ts";
import type { DokionPlaybook } from "../src/playbook/types.ts";
import { evaluateReleaseGates } from "../src/readiness/release-gates.ts";
import type { DokionState } from "../src/state/types.ts";

const roots: string[] = [];

async function root(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "dokion-gates-"));
  roots.push(path);
  await mkdir(join(path, ".dokion"), { recursive: true });
  return path;
}

function playbook(): DokionPlaybook {
  return {
    version: "1.0.0",
    project: { name: "gates", target: "READY_FOR_PRODUCTION" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY"
    },
    stages: [
      {
        id: "verify",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "required-check",
            capability: {
              type: "command",
              id: "required-check",
              immutable_reference: `sha256:${"a".repeat(64)}`
            },
            responsibility: "Run the required verification.",
            mode: "VERIFY_ONLY",
            required: true
          }
        ]
      }
    ],
    release_gates: [
      { id: "no-critical", condition: "open_findings.CRITICAL == 0", blocking: true },
      { id: "steps-complete", condition: "required_steps_complete == true", blocking: true },
      { id: "stable-playbook", condition: "playbook_tainted == false", blocking: true },
      { id: "coverage", condition: "blocking_lanes_assigned == true", blocking: true },
      { id: "command-pass", command: "printf gate-ok", blocking: true },
      { id: "command-fail", command: "printf gate-failed >&2; exit 7", blocking: false },
      { id: "unsupported", condition: "process.env.SECRET != null", blocking: true }
    ]
  };
}

function state(): DokionState {
  return {
    schema_version: 1,
    revision: 0,
    run: {
      id: "run-gates",
      started_at: "2026-07-25T12:00:00.000Z",
      status: "RUNNING"
    },
    repository_identity: {
      schema_version: 1,
      kind: "directory",
      canonical_root: "/fixture",
      root_digest: `sha256:${"1".repeat(64)}`,
      worktree_id: `sha256:${"1".repeat(64)}`,
      playbook_digest: `sha256:${"2".repeat(64)}`,
      captured_at: "2026-07-27T00:00:00.000Z"
    },
    playbook: {
      path: ".dokion/playbook.json",
      digest: `sha256:${"b".repeat(64)}`,
      verified_at: "2026-07-25T12:00:00.000Z"
    },
    stages: [
      {
        id: "verify",
        status: "SUCCEEDED",
        steps: [
          { id: "required-check", status: "SUCCEEDED", mode: "VERIFY_ONLY" }
        ]
      }
    ],
    coverage: [
      {
        lane: "application-security",
        status: "ASSIGNED",
        assigned_capabilities: ["security-check"],
        blocking: true
      }
    ]
  };
}

function finding(severity: NormalizedFinding["severity"], status: NormalizedFinding["status"]): NormalizedFinding {
  return {
    id: `DK-SEC-${severity === "CRITICAL" ? "001" : "002"}`,
    step_id: "security-review",
    stage_id: "security",
    severity,
    title: `${severity} fixture`,
    source: { capability_id: "fixture" },
    evidence: [],
    status
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("release gate evaluation", () => {
  test("evaluates the fixed condition vocabulary and exact command gates with evidence", async () => {
    const projectRoot = await root();
    const results = await evaluateReleaseGates({
      root: projectRoot,
      playbook: playbook(),
      state: state(),
      findings: [finding("HIGH", "VERIFIED")]
    });

    expect(results.map(({ id, status, exit_code }) => ({ id, status, exit_code }))).toEqual([
      { id: "no-critical", status: "PASS", exit_code: undefined },
      { id: "steps-complete", status: "PASS", exit_code: undefined },
      { id: "stable-playbook", status: "PASS", exit_code: undefined },
      { id: "coverage", status: "PASS", exit_code: undefined },
      { id: "command-pass", status: "PASS", exit_code: 0 },
      { id: "command-fail", status: "FAIL", exit_code: 7 },
      { id: "unsupported", status: "FAIL", exit_code: undefined }
    ]);
    expect(results.find((gate) => gate.id === "command-pass")?.artifact).toBe(
      ".dokion/evidence/run-gates/release-gates/command-pass.json"
    );
    expect(results.find((gate) => gate.id === "unsupported")?.evaluated).toContain("unsupported condition");
  });

  test("fails blocking conditions for active critical findings, incomplete required steps, taint, and uncovered blocking lanes", async () => {
    const projectRoot = await root();
    const current = state();
    current.stages[0]!.steps[0]!.status = "FAILED";
    current.playbook.tainted = {
      expected: current.playbook.digest,
      observed: `sha256:${"c".repeat(64)}`,
      detected_at: "2026-07-25T12:01:00.000Z"
    };
    current.coverage![0]!.status = "PARTIAL";

    const configured = playbook();
    configured.release_gates = configured.release_gates?.slice(0, 4);
    const results = await evaluateReleaseGates({
      root: projectRoot,
      playbook: configured,
      state: current,
      findings: [finding("CRITICAL", "OPEN")]
    });

    expect(results.every((gate) => gate.status === "FAIL" && gate.blocking)).toBe(true);
  });
});
