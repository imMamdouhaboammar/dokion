import { describe, expect, test } from "bun:test";

import {
  clearSchemaRegistryCache,
  validatePlaybookData
} from "../../src/contracts/schema-validator.ts";

const pinned = `sha256:${"a".repeat(64)}`;

function basePlaybook() {
  return {
    version: "1.0.0",
    project: { name: "typed-dataflow" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY"
    },
    stages: [{
      id: "pipeline",
      execution: "SEQUENTIAL",
      steps: [
        {
          id: "inspect",
          capability: {
            type: "skill",
            id: "repo-inspector",
            immutable_reference: pinned
          },
          responsibility: "Inspect the repository and produce a normalized analysis artifact.",
          mode: "ANALYZE",
          outputs: [{
            name: "analysis",
            kind: "json",
            media_type: "application/json"
          }]
        },
        {
          id: "review",
          capability: {
            type: "skill",
            id: "architecture-reviewer",
            immutable_reference: pinned
          },
          responsibility: "Review the normalized analysis artifact.",
          mode: "ANALYZE",
          depends_on: ["inspect"],
          inputs: [{
            name: "analysis",
            from: {
              step: "inspect",
              output: "analysis"
            },
            kind: "json",
            required: true
          }]
        }
      ]
    }]
  };
}

describe("Playbook typed dataflow contract", () => {
  test("accepts typed outputs and typed input bindings between declared steps", async () => {
    clearSchemaRegistryCache();

    expect(await validatePlaybookData(process.cwd(), basePlaybook())).toEqual([]);
  });

  test("keeps legacy string inputs and outputs schema-valid during migration", async () => {
    const playbook = basePlaybook();
    const stage = playbook.stages[0]!;
    stage.steps[0]!.outputs = ["analysis"] as never;
    stage.steps[1]!.inputs = ["analysis"] as never;
    clearSchemaRegistryCache();

    expect(await validatePlaybookData(process.cwd(), playbook)).toEqual([]);
  });
});
