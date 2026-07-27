import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderExecutionPlan } from "../../src/plan/render-plan.ts";

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-plan-"));
  roots.push(root);
  for (const directory of [".dokion", "src", "scripts"]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({
      name: "plan-fixture",
      private: true,
      scripts: { test: "bun test", build: "bun run build" },
      dependencies: { react: "19.0.0" }
    }, null, 2)}\n`
  );
  await writeFile(join(root, "src/app.ts"), "export const ready = true;\n");
  await writeFile(
    join(root, "scripts/should-not-run.ts"),
    "await Bun.write('executed.txt', 'plan executed a command');\n"
  );

  const digest = (character: string) => `sha256:${character.repeat(64)}`;
  const playbook = {
    version: "1.0.0",
    project: { name: "plan-fixture", target: "READY_FOR_STAGING" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY",
      capability_behavior: "USER_ONLY",
      automatic_capability_discovery: false,
      automatic_installation: false,
      automatic_substitution: false,
      automatic_reordering: false,
      allow_recommendations: true,
      recommendations_require_approval: true
    },
    enforcement: {
      playbook_immutable: true,
      hash_algorithm: "sha256",
      verify_before_each_step: true,
      on_mutation: "ABORT_TAINTED",
      protected_paths: [".dokion/playbook.json", "schemas/**"]
    },
    registry: {
      sources: ["dokion.json"],
      require_verified: true,
      require_digest: true,
      on_unverified: "STOP_STEP"
    },
    defaults: {
      approval: "BEFORE_WRITE",
      failure_policy: "STOP_PIPELINE",
      retry_count: 1,
      maximum_iterations: 2,
      parallel_execution: false,
      validation: {
        suppression_detection: true,
        require_evidence_artifact: true,
        forbid_test_deletion: true,
        forbid_out_of_scope_edits: true
      }
    },
    stages: [
      {
        id: "frontend",
        name: "Frontend checks",
        execution: "SEQUENTIAL",
        applicability: { when_profile: { has_frontend: true } },
        steps: [
          {
            id: "inspect-ui",
            capability: {
              type: "command",
              id: "fixture-inspector",
              version: "1.0.0",
              immutable_reference: digest("a")
            },
            responsibility: "Inspect the declared UI surface.",
            mode: "ANALYZE",
            required: true,
            permissions: {
              read: ["src/**"],
              write: [".dokion/**", "HARDENING.md"],
              network: false,
              shell: ["bun scripts/should-not-run.ts"],
              env: ["DOKION_OUTPUT"]
            },
            approval: "NEVER",
            verification: ["bun test"],
            failure_policy: "STOP_PIPELINE"
          },
          {
            id: "api-only",
            capability: {
              type: "command",
              id: "fixture-api-review",
              version: "1.0.0",
              immutable_reference: digest("b")
            },
            responsibility: "Inspect an API only when one is detected.",
            mode: "ANALYZE",
            required: false,
            depends_on: ["inspect-ui"],
            applicability: {
              when_profile: { has_api: true },
              on_inapplicable: "SKIP"
            },
            permissions: { read: ["src/**"], write: [], network: false, shell: [] }
          }
        ]
      },
      {
        id: "missing-surface",
        execution: "SEQUENTIAL",
        applicability: {
          when_paths_exist: ["missing.flag"],
          on_inapplicable: "STOP_STAGE"
        },
        steps: [
          {
            id: "never-run",
            capability: {
              type: "command",
              id: "fixture-never-run",
              version: "1.0.0",
              immutable_reference: digest("c")
            },
            responsibility: "Remain inert when the stage is inapplicable.",
            mode: "VERIFY_ONLY",
            required: true,
            permissions: {
              read: [],
              write: [],
              network: false,
              shell: ["bun scripts/should-not-run.ts"]
            },
            verification: ["bun scripts/should-not-run.ts"]
          }
        ]
      }
    ],
    release_gates: [
      { id: "tests", command: "bun test", blocking: true },
      { id: "no-critical", condition: "no_validated_critical_findings", blocking: true }
    ],
    coverage_policy: {
      blocking_lanes: ["ui-ux-and-accessibility"],
      unassigned_lane_readiness_cap: "CONDITIONALLY_READY"
    },
    manifest: "dokion.json"
  };
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function runCli(root: string, ...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, "run", join(process.cwd(), "src/cli.ts"), ...args], {
    cwd: root,
    env: { ...process.env, DOKION_AGENT: "codex" },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  return { exitCode, stdout, stderr };
}

describe("read-only execution plan", () => {
  test("renders exact order permissions approvals gates and applicability predictions", async () => {
    const root = await fixture();
    const before = await readFile(join(root, ".dokion/playbook.json"), "utf8");

    const plan = await renderExecutionPlan(root, { ...process.env, DOKION_AGENT: "codex" });

    expect(plan.playbook).toMatchObject({ project: "plan-fixture", target: "READY_FOR_STAGING" });
    expect(plan.stages.map((stage) => stage.id)).toEqual(["frontend", "missing-surface"]);
    const frontend = plan.stages[0]!;
    expect(frontend).toMatchObject({
      order: 1,
      id: "frontend",
      execution: "SEQUENTIAL",
      prediction: { disposition: "RUN", applicable: true }
    });
    expect(frontend.steps.map((step) => step.id)).toEqual(["inspect-ui", "api-only"]);
    expect(frontend.steps[0]).toMatchObject({
      order: 1,
      id: "inspect-ui",
      approval: "NEVER",
      failure_policy: "STOP_PIPELINE",
      retry_count: 1,
      maximum_iterations: 2,
      prediction: { disposition: "RUN", applicable: true },
      permissions: {
        read: ["src/**"],
        write: [".dokion/**", "HARDENING.md"],
        network: false,
        shell: ["bun scripts/should-not-run.ts"],
        env: ["DOKION_OUTPUT"]
      }
    });
    expect(frontend.steps[1]).toMatchObject({
      order: 2,
      id: "api-only",
      approval: "BEFORE_WRITE",
      prediction: {
        disposition: "SKIPPED_INAPPLICABLE",
        applicable: false,
        reason: "profile mismatch: has_api"
      }
    });

    const missing = plan.stages[1]!;
    expect(missing.prediction).toMatchObject({
      disposition: "STOPPED_BY_POLICY",
      applicable: false,
      reason: "required path pattern has no match: missing.flag"
    });
    expect(missing.steps[0]?.prediction).toMatchObject({
      disposition: "STOPPED_BY_POLICY",
      applicable: false
    });
    expect(plan.release_gates.map((gate) => gate.id)).toEqual(["tests", "no-critical"]);
    expect(plan.platform.agent).toBe("codex");

    expect(await readFile(join(root, ".dokion/playbook.json"), "utf8")).toBe(before);
    expect(await Bun.file(join(root, "executed.txt")).exists()).toBe(false);
    expect(await Bun.file(join(root, ".dokion/state.json")).exists()).toBe(false);
    expect(await Bun.file(join(root, "HARDENING.md")).exists()).toBe(false);
  });

  test("exposes the same plan through dokion plan without writes", async () => {
    const root = await fixture();
    const result = await runCli(root, "plan", "--format", "json");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const plan = JSON.parse(result.stdout) as {
      stages: Array<{ id: string; steps: Array<{ id: string; prediction: { disposition: string } }> }>;
      release_gates: Array<{ id: string }>;
    };
    expect(plan.stages.map((stage) => stage.id)).toEqual(["frontend", "missing-surface"]);
    expect(plan.stages[0]?.steps[1]?.prediction.disposition).toBe("SKIPPED_INAPPLICABLE");
    expect(plan.release_gates.map((gate) => gate.id)).toEqual(["tests", "no-critical"]);
    expect(await Bun.file(join(root, "executed.txt")).exists()).toBe(false);
    expect(await Bun.file(join(root, ".dokion/state.json")).exists()).toBe(false);
    expect(await Bun.file(join(root, "HARDENING.md")).exists()).toBe(false);
  });
});
