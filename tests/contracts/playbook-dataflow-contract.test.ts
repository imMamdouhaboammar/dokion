import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020.js";

import playbookSchema from "../../schemas/dokion-playbook.schema.json";
import stepInputSchema from "../../schemas/dokion-step-input.schema.json";
import stepOutputSchema from "../../schemas/dokion-step-output.schema.json";
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

  test("canonical public Playbook schema accepts the same typed handoff contract", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    ajv.addSchema(stepInputSchema);
    ajv.addSchema(stepOutputSchema);
    const validate = ajv.compile(playbookSchema);

    expect(validate(basePlaybook()), JSON.stringify(validate.errors, null, 2)).toBe(true);
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

  test("rejects a typed input that references its own consumer step", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[1].outputs = [{ name: "analysis", kind: "json" }];
    playbook.stages[0].steps[1].inputs[0].from.step = "review";
    playbook.stages[0].steps[1].depends_on = ["review"];

    expect(await validationMessages(playbook)).toContain("typed input cannot reference its own consumer step review");
  });

  test("rejects a typed producer declared after its consumer", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    const [inspect, review] = playbook.stages[0].steps;
    inspect.inputs = [{
      name: "review-result",
      from: { step: "review", output: "review-result" },
      kind: "json",
      required: true
    }];
    inspect.depends_on = ["review"];
    review.outputs = [{ name: "review-result", kind: "json" }];

    expect(await validationMessages(playbook)).toContain("typed input producer review must be declared before consumer inspect");
  });

  test("rejects a typed cycle because at least one producer cannot precede its consumer", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    const [inspect, review] = playbook.stages[0].steps;
    inspect.inputs = [{
      name: "review-result",
      from: { step: "review", output: "review-result" },
      kind: "json",
      required: true
    }];
    inspect.depends_on = ["review"];
    review.outputs = [{ name: "review-result", kind: "json" }];

    expect(await validationMessages(playbook)).toContain("typed input producer review must be declared before consumer inspect");
  });

  test("rejects duplicate step ids because typed producer references must resolve exactly one step", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    const duplicate = structuredClone(playbook.stages[0].steps[0]);
    playbook.stages.push({
      id: "second-stage",
      execution: "SEQUENTIAL",
      steps: [duplicate]
    });

    expect(await validationMessages(playbook)).toContain("step id inspect must be unique across the Playbook");
  });

  test("rejects duplicate typed output names within one producer step", async () => {
    const playbook = structuredClone(basePlaybook()) as any;
    playbook.stages[0].steps[0].outputs.push({ name: "analysis", kind: "json" });

    expect(await validationMessages(playbook)).toContain("step inspect declares duplicate typed output analysis");
  });
});
