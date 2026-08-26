import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readRunArtifact } from "../../src/artifacts/run-artifact-store.ts";
import { validatePlaybookData } from "../../src/contracts/schema-validator.ts";
import { ExecutionEngine } from "../../src/engine/execution-engine.ts";
import { initializeGitFixture } from "../helpers/git-fixture.ts";

const temporaryRoots: string[] = [];

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-invocation-"));
  temporaryRoots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await initializeGitFixture(root);
  return root;
}

function command(code: string): { executable: string; args: string[] } {
  return { executable: process.execPath, args: ["-e", code] };
}

async function writeTwoStepPlaybook(root: string): Promise<void> {
  const producerCommand = command('import { mkdir, readFile, writeFile } from "node:fs/promises"; import { dirname } from "node:path"; const requestPath = process.env.DOKION_INVOCATION_REQUEST; if (!requestPath) process.exit(61); const request = JSON.parse(await readFile(requestPath, "utf8")); const output = request.expected_outputs.find((item) => item.name === "message"); if (!output) process.exit(62); await mkdir(dirname(output.path), { recursive: true }); await writeFile(output.path, "hello from producer\\n");');
  const consumerCommand = command('import { mkdir, readFile, writeFile } from "node:fs/promises"; import { dirname } from "node:path"; const requestPath = process.env.DOKION_INVOCATION_REQUEST; if (!requestPath) process.exit(71); const request = JSON.parse(await readFile(requestPath, "utf8")); const input = request.inputs.find((item) => item.name === "message"); const output = request.expected_outputs.find((item) => item.name === "final"); if (!input || !output) process.exit(72); const producerValue = await readFile(input.artifact.blob_path, "utf8"); await mkdir(dirname(output.path), { recursive: true }); await writeFile(output.path, producerValue.replace("producer", "consumer"));');

  const playbook = {
    version: "1.0.0",
    project: { name: "invocation-handoff-fixture", target: "READY_FOR_STAGING" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY"
    },
    enforcement: {
      playbook_immutable: true,
      hash_algorithm: "sha256",
      verify_before_each_step: true,
      on_mutation: "ABORT_TAINTED",
      worktree_policy: "clean-only"
    },
    stages: [{
      id: "runtime",
      name: "Runtime",
      execution: "SEQUENTIAL",
      steps: [
        {
          id: "producer",
          responsibility: "Produce one declared artifact",
          mode: "VERIFY_ONLY",
          required: true,
          approval: "NEVER",
          capability: {
            type: "command",
            id: "producer-command",
            immutable_reference: `sha256:${"1".repeat(64)}`,
            entrypoint: { kind: "command", command: producerCommand }
          },
          permissions: {
            read: ["**/*"],
            write: [".dokion/**"],
            network: false,
            shell: [producerCommand]
          },
          inputs: [],
          outputs: [{ name: "message", kind: "text", media_type: "text/plain" }],
          verification: [],
          success_conditions: ["declared_output_materialized"],
          failure_policy: "STOP_PIPELINE"
        },
        {
          id: "consumer",
          responsibility: "Consume only the producer's declared artifact",
          mode: "VERIFY_ONLY",
          required: true,
          approval: "NEVER",
          depends_on: ["producer"],
          capability: {
            type: "command",
            id: "consumer-command",
            immutable_reference: `sha256:${"2".repeat(64)}`,
            entrypoint: { kind: "command", command: consumerCommand }
          },
          permissions: {
            read: ["**/*"],
            write: [".dokion/**"],
            network: false,
            shell: [consumerCommand]
          },
          inputs: [{
            name: "message",
            from: { step: "producer", output: "message" },
            kind: "text",
            required: true
          }],
          outputs: [{ name: "final", kind: "text", media_type: "text/plain" }],
          verification: [],
          success_conditions: ["declared_output_materialized"],
          failure_policy: "STOP_PIPELINE"
        }
      ]
    }],
    release_gates: []
  };

  const issues = await validatePlaybookData(root, playbook);
  expect(issues).toEqual([]);
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("universal capability invocation runtime", () => {
  test("passes a producer artifact to a consumer only through the declared Dokion handoff", async () => {
    const root = await createFixtureRoot();
    await writeTwoStepPlaybook(root);

    const state = await new ExecutionEngine(root).run();

    expect(state.run.status).toBe("COMPLETED");
    const producer = await readRunArtifact({ root, runId: state.run.id, stepId: "producer", outputName: "message" });
    const consumer = await readRunArtifact({ root, runId: state.run.id, stepId: "consumer", outputName: "final" });

    expect(new TextDecoder().decode(producer.bytes)).toBe("hello from producer\n");
    expect(new TextDecoder().decode(consumer.bytes)).toBe("hello from consumer\n");
    expect(consumer.descriptor.producer.invocation_id).not.toBe(producer.descriptor.producer.invocation_id);

    const invocationRoot = join(root, ".dokion", "runs", state.run.id, "invocations");
    const receiptPaths = Array.from(new Bun.Glob("*/receipt.json").scanSync({ cwd: invocationRoot, onlyFiles: true }));
    expect(receiptPaths).toHaveLength(2);

    const receipts = await Promise.all(receiptPaths.map(async (path) => (
      JSON.parse(await readFile(join(invocationRoot, path), "utf8"))
    )));
    const producerReceipt = receipts.find((receipt) => receipt.step_id === "producer");
    const consumerReceipt = receipts.find((receipt) => receipt.step_id === "consumer");

    expect(producerReceipt?.status).toBe("SUCCEEDED");
    expect(consumerReceipt?.status).toBe("SUCCEEDED");
    expect(consumerReceipt?.inputs[0].artifact.digest).toBe(producer.descriptor.digest);
    expect(consumerReceipt?.outputs[0].artifact.digest).toBe(consumer.descriptor.digest);
  });
});
