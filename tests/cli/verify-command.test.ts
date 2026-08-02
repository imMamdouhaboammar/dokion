import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initializeGitFixture } from "../helpers/git-fixture.ts";
import { loadActivePlaybook } from "../../src/playbook/load-playbook.ts";
import type { Applicability, ExecutionMode } from "../../src/playbook/types.ts";
import { StateStore } from "../../src/state/state-store.ts";

const roots: string[] = [];
const repositoryRoot = process.cwd();
const cliPath = join(repositoryRoot, "src/cli.ts");

interface FixtureStepOptions {
  mode?: ExecutionMode;
  capabilityCommand?: string;
  applicability?: Applicability;
  required?: boolean;
}

async function createFixture(
  gateCommand?: string,
  stepVerificationCommand?: string,
  stepOptions: FixtureStepOptions = {}
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-verify-command-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(repositoryRoot, "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(repositoryRoot, "dokion.json"), join(root, "dokion.json"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "verify-command" }, null, 2));

  const playbook = {
    version: "1.0.0",
    project: { name: "verify-command", target: "READY_FOR_STAGING" },
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
        id: "verification",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "declared-check",
            capability: {
              type: "command",
              id: "declared-check",
              immutable_reference: `sha256:${"a".repeat(64)}`
            },
            responsibility: "Declare the verification boundary.",
            mode: stepOptions.mode ?? "VERIFY_ONLY",
            approval: "NEVER",
            ...(stepOptions.required !== undefined ? { required: stepOptions.required } : {}),
            ...(stepOptions.applicability ? { applicability: stepOptions.applicability } : {}),
            ...(stepVerificationCommand || stepOptions.capabilityCommand ? {
              permissions: {
                read: ["**/*"],
                write: [".dokion/**"],
                network: false,
                shell: [stepOptions.capabilityCommand, stepVerificationCommand].filter(
                  (command): command is string => Boolean(command)
                )
              },
              ...(stepVerificationCommand ? { verification: [stepVerificationCommand] } : {})
            } : {})
          }
        ]
      }
    ],
    ...(gateCommand ? {
      release_gates: [
        { id: "declared-gate", command: gateCommand, blocking: true }
      ]
    } : {}),
    manifest: "dokion.json"
  };

  await writeFile(
    join(root, ".dokion/playbook.json"),
    `${JSON.stringify(playbook, null, 2)}\n`
  );
  await initializeGitFixture(root);

  const loaded = await loadActivePlaybook(root);
  await new StateStore(root).initialize({
    playbookDigest: loaded.digest,
    stages: loaded.data.stages.map((stage) => ({
      id: stage.id,
      steps: stage.steps.map((step) => ({ id: step.id, mode: step.mode }))
    }))
  });
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("dokion verify declared-gate execution", () => {
  test("executes a failing declared gate, records evidence, and exits nonzero", async () => {
    const root = await createFixture("printf 'executed\\n' > .dokion/verify-marker; exit 7");
    const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    expect(await readFile(join(root, ".dokion/verify-marker"), "utf8")).toBe("executed\n");

    const result = JSON.parse(stdout) as {
      passed: boolean;
      status: string;
      results: Array<{ gateId: string; exitCode: number; artifact?: string }>;
    };
    expect(result.passed).toBe(false);
    expect(result.status).toBe("FAIL");
    expect(result.results).toContainEqual(expect.objectContaining({
      gateId: "declared-gate",
      exitCode: 7
    }));

    const persisted = await new StateStore(root).load();
    expect(persisted.release_gates).toContainEqual(expect.objectContaining({
      id: "declared-gate",
      status: "FAIL",
      exit_code: 7
    }));
    const artifact = persisted.release_gates?.[0]?.artifact;
    expect(artifact).toBeDefined();
    expect(await Bun.file(join(root, artifact!)).exists()).toBe(true);
  });

  test("re-runs passing gates and records fresh evidence on every invocation", async () => {
    const root = await createFixture("printf 'verified\\n' >> .dokion/verify-count");
    const artifacts: string[] = [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        child.stdout ? new Response(child.stdout).text() : "",
        child.stderr ? new Response(child.stderr).text() : "",
        child.exited
      ]);
      expect(stderr).toBe("");
      expect(exitCode).toBe(0);
      const result = JSON.parse(stdout) as {
        passed: boolean;
        evidence: string[];
      };
      expect(result.passed).toBe(true);
      expect(result.evidence).toHaveLength(1);
      artifacts.push(result.evidence[0]!);
    }

    expect(await readFile(join(root, ".dokion/verify-count"), "utf8")).toBe("verified\nverified\n");
    expect(new Set(artifacts).size).toBe(2);
    expect(await Bun.file(join(root, artifacts[0]!)).exists()).toBe(true);
    expect(await Bun.file(join(root, artifacts[1]!)).exists()).toBe(true);
  });

  test("re-runs declared step verification commands without executing repairs", async () => {
    const stepCommand = "printf 'step-verified\\n' > .dokion/step-verify-marker; exit 9";
    const repairCommand = "printf 'repair-ran\\n' > .dokion/repair-marker";
    const root = await createFixture(undefined, stepCommand, {
      mode: "FIX_AUTOMATICALLY",
      capabilityCommand: repairCommand
    });
    const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    expect(await readFile(join(root, ".dokion/step-verify-marker"), "utf8")).toBe("step-verified\n");
    expect(await Bun.file(join(root, ".dokion/repair-marker")).exists()).toBe(false);
    const result = JSON.parse(stdout) as {
      passed: boolean;
      configuredGates: number;
      executedCommands: number;
      results: Array<{
        scope?: string;
        stageId?: string;
        stepId?: string;
        command?: string;
        exitCode?: number;
        artifact?: string;
      }>;
    };
    expect(result.passed).toBe(false);
    expect(result.configuredGates).toBe(1);
    expect(result.executedCommands).toBe(1);
    expect(result.results).toContainEqual(expect.objectContaining({
      scope: "STEP",
      stageId: "verification",
      stepId: "declared-check",
      command: stepCommand,
      exitCode: 9
    }));
    const persisted = await new StateStore(root).load();
    expect(persisted.stages[0]?.steps[0]?.verification_results).toContainEqual(expect.objectContaining({
      command: stepCommand,
      exit_code: 9
    }));
  });

  test("does not execute an inapplicable required verification command", async () => {
    const stepCommand = "printf 'should-not-run\\n' > .dokion/inapplicable-marker";
    const root = await createFixture(undefined, stepCommand, {
      required: true,
      applicability: {
        when_profile: { has_frontend: true },
        on_inapplicable: "SKIP"
      }
    });
    const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    expect(await Bun.file(join(root, ".dokion/inapplicable-marker")).exists()).toBe(false);
    const result = JSON.parse(stdout) as {
      configuredGates: number;
      executedCommands: number;
      results: Array<{
        scope?: string;
        disposition?: string;
        reason?: string;
        passed?: boolean;
      }>;
    };
    expect(result.configuredGates).toBe(1);
    expect(result.executedCommands).toBe(0);
    expect(result.results).toContainEqual(expect.objectContaining({
      scope: "STEP",
      disposition: "INAPPLICABLE",
      reason: "profile mismatch: has_frontend",
      passed: false
    }));
  });

  test("validates persisted verification topology before executing commands", async () => {
    const stepCommand = "printf 'must-not-run\\n' > .dokion/stale-state-marker";
    const root = await createFixture(undefined, stepCommand);
    const store = new StateStore(root);
    const state = await store.load();
    await store.update(state.revision, (current) => ({ ...current, stages: [] }));

    const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
    });
    const [stderr, exitCode] = await Promise.all([
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    expect(exitCode, stderr).toBe(1);
    expect(await Bun.file(join(root, ".dokion/stale-state-marker")).exists()).toBe(false);
  });

  test("fails closed when the active Playbook declares no verification or release gates", async () => {
    const root = await createFixture();
    const child = Bun.spawn([process.execPath, cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, PATH: `/home/codespace/.bun/bin:${process.env.PATH ?? ""}` }
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    expect(stderr).toBe("");
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout) as {
      passed: boolean;
      configuredGates: number;
      limitations: string[];
    };
    expect(result.passed).toBe(false);
    expect(result.configuredGates).toBe(0);
    expect(result.limitations).toContain("NO_DECLARED_VERIFICATION_OR_RELEASE_GATES");
  });
});
