import { describe, expect, test } from "bun:test";

import { validatePlaybookData } from "../src/contracts/schema-validator.ts";
import { evaluateCoverage } from "../src/readiness/coverage.ts";
import type { DokionPlaybook } from "../src/playbook/types.ts";
import type { DokionState } from "../src/state/types.ts";

function playbook(): DokionPlaybook {
  return {
    version: "1.0.0",
    project: { name: "coverage-fixture", target: "READY_FOR_PRODUCTION" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY",
      automatic_capability_discovery: false,
      automatic_installation: false,
      automatic_substitution: false,
      automatic_reordering: false,
      recommendations_require_approval: true
    },
    enforcement: {},
    registry: {},
    defaults: {},
    coverage_policy: {
      blocking_lanes: ["application-security", "supply-chain-and-release-security"],
      acknowledged_gaps: [
        {
          lane: "observability",
          acknowledged_by: "mamdouh",
          rationale: "Static logging review only for this release."
        }
      ],
      unassigned_lane_readiness_cap: "CONDITIONALLY_READY"
    },
    stages: [
      {
        id: "security",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "sast",
            capability: {
              type: "command",
              id: "semgrep",
              version: "1.2.3",
              immutable_reference: `sha256:${"a".repeat(64)}`
            },
            responsibility: "Run the approved application security rules.",
            mode: "ANALYZE",
            coverage_lanes: [
              { lane: "application-security", status: "ASSIGNED" }
            ]
          },
          {
            id: "logging-review",
            capability: {
              type: "command",
              id: "logging-review",
              version: "1.0.0",
              immutable_reference: `sha256:${"b".repeat(64)}`
            },
            responsibility: "Review structured logging coverage.",
            mode: "ANALYZE",
            coverage_lanes: [
              { lane: "observability", status: "PARTIAL" }
            ]
          },
          {
            id: "mobile-review",
            capability: {
              type: "command",
              id: "mobile-review",
              version: "1.0.0",
              immutable_reference: `sha256:${"c".repeat(64)}`
            },
            responsibility: "Review native mobile security when applicable.",
            mode: "ANALYZE",
            coverage_lanes: [
              { lane: "mobile-native-security", status: "ASSIGNED" }
            ]
          }
        ]
      }
    ],
    release_gates: [],
    manifest: "dokion.json"
  };
}

function state(): DokionState {
  return {
    schema_version: 1,
    revision: 0,
    run: {
      id: "run-coverage",
      started_at: "2026-07-25T12:00:00.000Z",
      status: "RUNNING",
      agent: "codex"
    },
    playbook: {
      path: ".dokion/playbook.json",
      digest: `sha256:${"d".repeat(64)}`,
      verified_at: "2026-07-25T12:00:00.000Z"
    },
    stages: [
      {
        id: "security",
        status: "IN_PROGRESS",
        steps: [
          { id: "sast", status: "SUCCEEDED", mode: "ANALYZE" },
          { id: "logging-review", status: "PENDING", mode: "ANALYZE" },
          {
            id: "mobile-review",
            status: "SKIPPED_INAPPLICABLE",
            mode: "ANALYZE",
            skip_reason: "profile mismatch: mobile_native"
          }
        ]
      }
    ]
  };
}

const manifest = {
  coverage: {
    gaps_requiring_user_selected_capabilities: [
      {
        lane: "application-security",
        status: "UNASSIGNED",
        reason: "No default SAST capability is active."
      },
      {
        lane: "observability",
        status: "UNASSIGNED",
        reason: "No default observability capability is active."
      },
      {
        lane: "performance-benchmarking",
        status: "PARTIAL",
        reason: "Only frontend lab checks are available."
      },
      {
        lane: "supply-chain-and-release-security",
        status: "UNASSIGNED",
        reason: "No default supply-chain capability is active."
      },
      {
        lane: "mobile-native-security",
        status: "UNASSIGNED",
        reason: "No default native mobile capability is active."
      }
    ]
  }
};

describe("coverage lane evaluation", () => {
  test("the playbook schema accepts explicit user-authored lane assignments", async () => {
    const issues = await validatePlaybookData(process.cwd(), playbook(), "coverage-fixture.json");
    expect(issues).toEqual([]);
  });

  test("assigns lanes only from applicable declared steps and preserves partial and acknowledged gaps", () => {
    const result = evaluateCoverage({
      manifest,
      playbook: playbook(),
      state: state()
    });

    expect(result.lanes).toEqual([
      {
        lane: "application-security",
        status: "ASSIGNED",
        assigned_capabilities: ["semgrep"],
        blocking: true
      },
      {
        lane: "mobile-native-security",
        status: "UNASSIGNED",
        assigned_capabilities: [],
        blocking: false
      },
      {
        lane: "observability",
        status: "PARTIAL",
        assigned_capabilities: ["logging-review"],
        blocking: false,
        acknowledged_by: "mamdouh"
      },
      {
        lane: "performance-benchmarking",
        status: "PARTIAL",
        assigned_capabilities: [],
        blocking: false
      },
      {
        lane: "supply-chain-and-release-security",
        status: "UNASSIGNED",
        assigned_capabilities: [],
        blocking: true
      }
    ]);
    expect(result.blocking_unassigned_lanes).toEqual(["supply-chain-and-release-security"]);
    expect(result.readiness_cap).toBe("CONDITIONALLY_READY");
  });

  test("does not infer coverage from a stage name or project profile", () => {
    const configured = playbook();
    configured.stages[0]!.steps[0]!.coverage_lanes = [];

    const result = evaluateCoverage({ manifest, playbook: configured, state: state() });
    expect(result.lanes.find((lane) => lane.lane === "application-security")).toEqual({
      lane: "application-security",
      status: "UNASSIGNED",
      assigned_capabilities: [],
      blocking: true
    });
  });
});
