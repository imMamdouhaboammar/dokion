import { afterEach, describe, expect, test } from "bun:test";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { validatePlaybookData } from "../../src/contracts/schema-validator.ts";
import { ExecutionEngine } from "../../src/engine/execution-engine.ts";
import { initializeGitFixture } from "../helpers/git-fixture.ts";

const roots: string[] = [];

type Command = { executable: string; args: string[] };

function command(code: string): Command {
  return { executable: process.execPath, args: ["-e", code] };
}

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-invocation-failure-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await initializeGitFixture(root);
  return root;
}

async function writeSingleStepPlaybook(options: {
  root: string;
  entrypoint: Command;
  shell: Command[];
  outputs?: Array<{ name: string; kind: "text"; media_type: string }>;
}): Promise<void> {
  const playbook = {
    version: "1.0.0",
    project: { name: "invocation-failure-fixture", target: "READY_FOR_STAGING" },
    authority: { capability_selection: "USER_ONLY", execution_order: "USER_ONLY" },
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
      steps: [{
        id: "invoke",
        responsibility: "Invoke one explicitly declared command capability",
        mode: "VERIFY_ONLY",
        required: true,
        approval: "NEVER",
        capability: {
          type: "command",
          id: "fixture-command",
          immutable_reference: `sha256:${"3".repeat(64)}`,
          entrypoint: { kind: "command", command: options.entrypoint }
        },
        permissions: {
          read: ["**/*"],
          write: [".dokion/**"],
          network: false,
          shell: options.shell
        },
        inputs: [],
        outputs: options.outputs ?? [],
        verification: [],
        success_conditions: ["invocation_succeeded"],
        failure_policy: "STOP_PIPELINE"
      }]
    }],
    release_gates: []
  };

  expect(await validatePlaybookData(options.root, playbook)).toEqual([]);
  await writeFile(join(options.root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
}

async function readOnlyReceipt(root: string, runId: string): Promise<Record<string, any>> {
  const invocationRoot = join(root, ".dokion", "runs", runId, "invocations");
  const receipts = Array.from(new Bun.Glob("*/receipt.json").scanSync({ cwd: invocationRoot, onlyFiles: true }));
  expect(receipts).toHaveLength(1);
  return JSON.parse(await readFile(join(invocationRoot, receipts[0]!), "utf8"));
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("universal capability invocation failure semantics", () => {
  test("entrypoint identity does not grant shell authority and is rejected before execution", async () => {
    const root = await createRoot();
    const marker = join(root, ".dokion", "must-not-run");
    const selected = command(`await Bun.write(${JSON.stringify(marker)}, "executed");`);
    const granted = command('console.log("different command")');
    await writeSingleStepPlaybook({ root, entrypoint: selected, shell: [granted] });

    const state = await new ExecutionEngine(root).run();

    expect(state.run.status).toBe("FAILED");
    expect(state.stages[0]!.steps[0]!.failure_reason).toContain("permissions.shell");
    await expect(access(marker)).rejects.toBeDefined();
  });

  test("exit code zero is not success when a declared output is missing", async () => {
    const root = await createRoot();
    const selected = command("process.exit(0);");
    await writeSingleStepPlaybook({
      root,
      entrypoint: selected,
      shell: [selected],
      outputs: [{ name: "required", kind: "text", media_type: "text/plain" }]
    });

    const state = await new ExecutionEngine(root).run();
    const receipt = await readOnlyReceipt(root, state.run.id);

    expect(state.run.status).toBe("FAILED");
    expect(receipt.status).toBe("FAILED");
    expect(receipt.command.exit_code).toBe(0);
    expect(receipt.failure.code).toBe("ARTIFACT_NOT_FOUND");
  });

  test("rejects undeclared output files instead of smuggling them into the artifact surface", async () => {
    const root = await createRoot();
    const selected = command('import { mkdir, readFile, writeFile } from "node:fs/promises"; import { dirname, join } from "node:path"; const request = JSON.parse(await readFile(process.env.DOKION_INVOCATION_REQUEST, "utf8")); const output = request.expected_outputs[0]; await mkdir(dirname(output.path), { recursive: true }); await writeFile(output.path, "declared"); await writeFile(join(dirname(output.path), "smuggled.bin"), "undeclared");');
    await writeSingleStepPlaybook({
      root,
      entrypoint: selected,
      shell: [selected],
      outputs: [{ name: "declared", kind: "text", media_type: "text/plain" }]
    });

    const state = await new ExecutionEngine(root).run();
    const receipt = await readOnlyReceipt(root, state.run.id);

    expect(state.run.status).toBe("FAILED");
    expect(receipt.status).toBe("FAILED");
    expect(receipt.failure.code).toBe("ARTIFACT_INVALID");
    expect(receipt.outputs).toEqual([]);
  });
});
