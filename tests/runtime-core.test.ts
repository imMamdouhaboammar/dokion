import { afterEach, describe, expect, test } from "bun:test";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validateRepositoryContracts } from "../src/contracts/schema-validator.ts";
import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import { assertPlaybookUnchanged, loadActivePlaybook } from "../src/playbook/load-playbook.ts";
import { StateStore } from "../src/state/state-store.ts";

const temporaryRoots: string[] = [];

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-test-"));
  temporaryRoots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  return root;
}

async function buildExecutablePlaybook(root: string, commands: string[]): Promise<Record<string, unknown>> {
  const raw = await readFile(join(process.cwd(), "playbooks/example.playbook.json"), "utf8");
  const playbook = JSON.parse(raw.replaceAll("sha256:PLACEHOLDER", `sha256:${"a".repeat(64)}`));
  const template = playbook.stages[0].steps[0];

  playbook.project.name = "runtime-fixture";
  playbook.project.target = "READY_FOR_STAGING";
  playbook.stages = [
    {
      id: "runtime",
      name: "Runtime",
      execution: "SEQUENTIAL",
      steps: commands.map((command, index) => ({
        ...structuredClone(template),
        id: `step-${index + 1}`,
        responsibility: `Execute verification command ${index + 1}`,
        mode: "VERIFY_ONLY",
        approval: "NEVER",
        capability: {
          ...structuredClone(template.capability),
          id: `fixture-capability-${index + 1}`,
          immutable_reference: `sha256:${String(index + 1).repeat(64)}`
        },
        permissions: {
          read: ["**/*"],
          write: [".dokion/**", "HARDENING.md"],
          network: false,
          shell: [command]
        },
        verification: [command],
        success_conditions: ["verification_exit_zero"],
        failure_policy: "STOP_PIPELINE"
      }))
    }
  ];
  playbook.release_gates = [];

  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return playbook;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("repository contracts", () => {
  test("the shipped manifest and reference playbooks validate", async () => {
    const summary = await validateRepositoryContracts(process.cwd());

    expect(summary.valid).toBe(true);
    expect(summary.checkedFiles).toContain("dokion.json");
    expect(summary.checkedFiles).toContain("playbooks/example.playbook.json");
    expect(summary.errors).toEqual([]);
  });
});

describe("immutable playbook loading", () => {
  test("an active playbook with placeholder digests is not executable", async () => {
    const root = await createFixtureRoot();
    await cp(join(process.cwd(), "playbooks/example.playbook.json"), join(root, ".dokion/playbook.json"));

    await expect(loadActivePlaybook(root)).rejects.toMatchObject({ code: "UNPINNED_CAPABILITY" });
  });

  test("a loaded playbook detects mutation", async () => {
    const root = await createFixtureRoot();
    await buildExecutablePlaybook(root, ["printf ok"]);
    const loaded = await loadActivePlaybook(root);

    const path = join(root, ".dokion/playbook.json");
    await writeFile(path, `${await readFile(path, "utf8")}\n`);

    await expect(assertPlaybookUnchanged(loaded)).rejects.toMatchObject({ code: "PLAYBOOK_TAINTED" });
  });
});

describe("state persistence", () => {
  test("state updates are atomic and readable after replacement", async () => {
    const root = await createFixtureRoot();
    const store = new StateStore(root);
    const initial = await store.initialize({
      playbookDigest: `sha256:${"b".repeat(64)}`,
      commitSha: "abcdef1",
      stages: [{ id: "runtime", steps: [{ id: "step-1", mode: "VERIFY_ONLY" }] }]
    });

    expect(initial.run.status).toBe("RUNNING");
    const updated = await store.update((state) => ({
      ...state,
      stages: state.stages.map((stage) => ({
        ...stage,
        steps: stage.steps.map((step) => step.id === "step-1" ? { ...step, status: "IN_PROGRESS" } : step)
      }))
    }));

    expect(updated.stages[0]?.steps[0]?.status).toBe("IN_PROGRESS");
    expect((await store.load()).stages[0]?.steps[0]?.status).toBe("IN_PROGRESS");
    await expect(access(join(root, ".dokion/state.json.tmp"))).rejects.toBeDefined();
  });
});

describe("ordered execution and recovery", () => {
  test("verification commands run in declared order and resume does not rerun successes", async () => {
    const root = await createFixtureRoot();
    await buildExecutablePlaybook(root, [
      "printf 'first\\n' >> .dokion/order.log",
      "printf 'second\\n' >> .dokion/order.log"
    ]);

    const engine = new ExecutionEngine(root);
    const completed = await engine.run();

    expect(completed.run.status).toBe("COMPLETED");
    expect(await readFile(join(root, ".dokion/order.log"), "utf8")).toBe("first\nsecond\n");
    expect(completed.stages.flatMap((stage) => stage.steps.map((step) => step.status))).toEqual(["SUCCEEDED", "SUCCEEDED"]);

    const resumed = await new ExecutionEngine(root).resume();
    expect(resumed.run.status).toBe("COMPLETED");
    expect(await readFile(join(root, ".dokion/order.log"), "utf8")).toBe("first\nsecond\n");
    await access(join(root, ".dokion/evidence/runtime/step-1/verification-1.json"));
    await access(join(root, ".dokion/evidence/runtime/step-2/verification-1.json"));
  });

  test("mutating the active playbook between steps taints and aborts the run", async () => {
    const root = await createFixtureRoot();
    const mutation = "python3 -c \"from pathlib import Path; p=Path('.dokion/playbook.json'); p.write_text(p.read_text().replace('step-2', 'step-x', 1))\"";
    await buildExecutablePlaybook(root, [mutation, "printf should-not-run"]);

    const state = await new ExecutionEngine(root).run();

    expect(state.run.status).toBe("TAINTED");
    expect(state.stages[0]?.steps[0]?.status).toBe("SUCCEEDED");
    expect(state.stages[0]?.steps[1]?.status).toBe("PENDING");
    await expect(access(join(root, ".dokion/evidence/runtime/step-2/verification-1.json"))).rejects.toBeDefined();
  });
});
