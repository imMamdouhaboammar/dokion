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

async function validationMessages(playbook: unknown): Promise<string[]> {
  clearSchemaRegistryCache();
  return (await validatePlaybookData(process.cwd(), playbook)).map((issue) => issue.message);
}

describe("Playbook typed dataflow contract", () => {
  test("accepts typed outputs and typed input bindings between declared steps", async () => {
    expect(await validatePlaybookData(process.cwd(), basePlaybook())).toEqual([]);
  });

  test("keeps legacy string inputs and outputs schema-valid during migration", async () => {
    const playbook = basePlaybook();
    const stage = playbook.stages[0]!;
    stage.steps[0]!.outputs = ["analysis"] as never;
    stage.steps[1]!.inputs = ["analysis"] as never;

    expect(await validatePlaybookData(process.cwd(), playbook)).toEqual([]);
  });

  test("rejects a typed input whose producer step does not exist", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[1].inputs[0].from.step = "missing-step";
    playbook.stages[0].steps[1].depends_on = ["missing-step"];

    expect(await validationMessages(playbook)).toContain("typed input references undeclared producer step missing-step");
  });

  test("rejects a typed input whose declared producer output does not exist", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[1].inputs[0].from.output = "missing-output";

    expect(await validationMessages(playbook)).toContain("typed input references undeclared output inspect.missing-output");
  });

  test("rejects a typed handoff whose input kind disagrees with the producer output kind", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[1].inputs[0].kind = "text";

    expect(await validationMessages(playbook)).toContain("typed input kind text does not match producer output kind json for inspect.analysis");
  });

  test("requires the producer step to be an explicit dependency instead of inferring order from the handoff", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    delete playbook.stages[0].steps[1].depends_on;

    expect(await validationMessages(playbook)).toContain("typed input from inspect requires inspect in depends_on");
  });

  test("rejects duplicate typed output names within one producer step", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[0].outputs.push({ name: "analysis", kind: "json" });

    expect(await validationMessages(playbook)).toContain("step inspect declares duplicate typed output analysis");
  });
});
