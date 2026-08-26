import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invokeCommandCapability } from "../../src/invocation/command-capability-invoker.ts";
import { loadActivePlaybook } from "../../src/playbook/load-playbook.ts";
import { initializeGitFixture } from "../helpers/git-fixture.ts";

const roots: string[] = [];

async function createFixture(): Promise<{ root: string; marker: string }> {
  const root = await mkdtemp(join(tmpdir(), "dokion-invocation-retry-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await initializeGitFixture(root);

  const marker = join(root, ".dokion", "retry-marker");
  const command = {
    executable: process.execPath,
    args: [
      "-e",
      `import { appendFile } from "node:fs/promises"; await appendFile(${JSON.stringify(marker)}, "x\\n"); process.exit(9);`
    ]
  };
  const playbook = {
    version: "1.0.0",
    project: { name: "invocation-retry-fixture", target: "READY_FOR_STAGING" },
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
        id: "retryable",
        responsibility: "Exercise one failed command attempt at a time",
        mode: "VERIFY_ONLY",
        required: true,
        approval: "NEVER",
        capability: {
          type: "command",
          id: "retry-command",
          immutable_reference: `sha256:${"a".repeat(64)}`,
          entrypoint: { kind: "command", command }
        },
        permissions: {
          read: ["**/*"],
          write: [".dokion/**"],
          network: false,
          shell: [command]
        },
        inputs: [],
        outputs: [],
        verification: [],
        success_conditions: ["invocation_succeeded"],
        failure_policy: "STOP_PIPELINE"
      }]
    }],
    release_gates: []
  };
  await writeFile(join(root, ".dokion", "playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return { root, marker };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("command invocation retry identity", () => {
  test("a new execution attempt gets a distinct invocation and actually re-executes", async () => {
    const { root, marker } = await createFixture();
    const loaded = await loadActivePlaybook(root);
    const stage = loaded.data.stages[0]!;
    const step = stage.steps[0]!;
    const invoke = invokeCommandCapability as unknown as (input: {
      root: string;
      runId: string;
      stage: typeof stage;
      step: typeof step;
      attempt: number;
    }) => ReturnType<typeof invokeCommandCapability>;

    const first = await invoke({ root, runId: "run-retry", stage, step, attempt: 1 });
    const second = await invoke({ root, runId: "run-retry", stage, step, attempt: 2 });

    expect(first.status).toBe("FAILED");
    expect(second.status).toBe("FAILED");
    expect(second.receiptPath).not.toBe(first.receiptPath);
    expect(await Bun.file(marker).text()).toBe("x\nx\n");
  });
});
