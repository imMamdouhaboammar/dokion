import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initializeGitFixture } from "./helpers/git-fixture.ts";

import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import { StateStore } from "../src/state/state-store.ts";

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-gates-runtime-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "gates-runtime" }, null, 2));
  await initializeGitFixture(root);

  const verify = "printf 'step\\n' >> .dokion/order.log";
  const gate = "printf 'gate\\n' >> .dokion/gate.log";
  const playbook = {
    version: "1.0.0",
    project: { name: "gates-runtime", target: "READY_FOR_STAGING" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY",
      automatic_capability_discovery: false,
      automatic_installation: false,
      automatic_substitution: false,
      automatic_reordering: false,
      recommendations_require_approval: true
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
            responsibility: "Complete the required verification.",
            mode: "VERIFY_ONLY",
            required: true,
            approval: "NEVER",
            permissions: {
              read: ["**/*"],
              write: [".dokion/**", "HARDENING.md"],
              network: false,
              shell: [verify]
            },
            verification: [verify]
          }
        ]
      }
    ],
    release_gates: [
      { id: "steps-complete", condition: "required_steps_complete == true", blocking: true },
      { id: "command-gate", command: gate, blocking: true }
    ],
    manifest: "dokion.json"
  };
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("completed runs persist release gates and resume does not rerun command gates", async () => {
  const root = await fixture();
  const completed = await new ExecutionEngine(root).run();

  expect(completed.run.status).toBe("COMPLETED");
  expect(completed.release_gates?.map(({ id, status }) => ({ id, status }))).toEqual([
    { id: "steps-complete", status: "PASS" },
    { id: "command-gate", status: "PASS" }
  ]);
  expect(await readFile(join(root, ".dokion/gate.log"), "utf8")).toBe("gate\n");

  await new ExecutionEngine(root).resume();
  const persisted = await new StateStore(root).load();
  expect(persisted.release_gates?.every((gate) => gate.status === "PASS")).toBe(true);
  expect(await readFile(join(root, ".dokion/gate.log"), "utf8")).toBe("gate\n");
}, 20000);
