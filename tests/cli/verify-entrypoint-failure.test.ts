import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadActivePlaybook } from "../../src/playbook/load-playbook.ts";
import { StateStore } from "../../src/state/state-store.ts";
import { verifyDeclaredGates } from "../../src/verification/verify-run.ts";
import { initializeGitFixture } from "../helpers/git-fixture.ts";

const roots: string[] = [];

async function createFixture(): Promise<{ root: string; verificationCommands: string[] }> {
  const root = await mkdtemp(join(tmpdir(), "dokion-verify-entrypoint-failure-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "verify-entrypoint-failure" }, null, 2));

  const entrypoint = { executable: process.execPath, args: ["-e", "process.exit(7)"] };
  const verificationCommands = [
    "printf 'first\\n' > .dokion/first-verification",
    "printf 'second\\n' > .dokion/second-verification"
  ];
  const playbook = {
    version: "1.0.0",
    project: { name: "verify-entrypoint-failure", target: "READY_FOR_STAGING" },
    authority: { capability_selection: "USER_ONLY", execution_order: "USER_ONLY" },
    enforcement: {
      playbook_immutable: true,
      hash_algorithm: "sha256",
      verify_before_each_step: true,
      on_mutation: "ABORT_TAINTED",
      worktree_policy: "clean-only"
    },
    stages: [{
      id: "verification",
      name: "Verification",
      execution: "SEQUENTIAL",
      steps: [{
        id: "declared-check",
        responsibility: "Preserve all declared verification gates after entrypoint failure",
        mode: "VERIFY_ONLY",
        required: true,
        approval: "NEVER",
        capability: {
          type: "command",
          id: "failing-entrypoint",
          immutable_reference: `sha256:${"b".repeat(64)}`,
          entrypoint: { kind: "command", command: entrypoint }
        },
        permissions: {
          read: ["**/*"],
          write: [".dokion/**"],
          network: false,
          shell: [entrypoint, ...verificationCommands]
        },
        inputs: [],
        outputs: [],
        verification: verificationCommands,
        success_conditions: ["verification_passed"],
        failure_policy: "STOP_PIPELINE"
      }]
    }],
    release_gates: [],
    manifest: "dokion.json"
  };

  await writeFile(join(root, ".dokion", "playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  await initializeGitFixture(root);
  const loaded = await loadActivePlaybook(root);
  await new StateStore(root).initialize({
    playbookDigest: loaded.digest,
    stages: loaded.data.stages.map((stage) => ({
      id: stage.id,
      steps: stage.steps.map((step) => ({ id: step.id, mode: step.mode }))
    }))
  });
  return { root, verificationCommands };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("verify command fallback after capability entrypoint failure", () => {
  test("reports every unexecuted declared verification command as denied", async () => {
    const { root, verificationCommands } = await createFixture();

    const result = await verifyDeclaredGates(root);
    const declared = result.results.filter(
      (candidate) => candidate.scope === "STEP" && (candidate.commandIndex ?? 0) > 0
    );

    expect(result.status).toBe("FAIL");
    expect(declared).toHaveLength(2);
    expect(declared).toEqual(expect.arrayContaining([
      expect.objectContaining({
        commandIndex: 1,
        command: verificationCommands[0],
        disposition: "DENIED",
        passed: false
      }),
      expect.objectContaining({
        commandIndex: 2,
        command: verificationCommands[1],
        disposition: "DENIED",
        passed: false
      })
    ]));
  });
});
