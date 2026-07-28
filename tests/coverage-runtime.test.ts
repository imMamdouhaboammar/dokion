import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { initializeGitFixture } from "./helpers/git-fixture.ts";

import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import { StateStore } from "../src/state/state-store.ts";

const roots: string[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-coverage-runtime-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "coverage-runtime" }, null, 2));
  await writeFile(join(root, "src/index.ts"), "export const api = true;\n");
  await initializeGitFixture(root);

  const digest = (character: string) => `sha256:${character.repeat(64)}`;
  const command = "printf 'verified\\n' >> .dokion/coverage.log";
  const playbook = {
    version: "1.0.0",
    project: { name: "coverage-runtime", target: "READY_FOR_STAGING" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY",
      automatic_capability_discovery: false,
      automatic_installation: false,
      automatic_substitution: false,
      automatic_reordering: false,
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
    coverage_policy: {
      blocking_lanes: ["application-security"],
      unassigned_lane_readiness_cap: "CONDITIONALLY_READY"
    },
    stages: [
      {
        id: "coverage",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "frontend-security",
            capability: {
              type: "command",
              id: "frontend-security",
              version: "1.0.0",
              immutable_reference: digest("a")
            },
            responsibility: "Run application security checks only for frontend projects.",
            mode: "VERIFY_ONLY",
            approval: "NEVER",
            applicability: {
              when_profile: { has_frontend: true },
              on_inapplicable: "SKIP"
            },
            coverage_lanes: [
              { lane: "application-security", status: "ASSIGNED" }
            ],
            permissions: {
              read: ["**/*"],
              write: [".dokion/**", "HARDENING.md"],
              network: false,
              shell: [command]
            },
            verification: [command],
            failure_policy: "STOP_PIPELINE"
          }
        ]
      }
    ],
    release_gates: [],
    manifest: "dokion.json"
  };
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("runtime persists coverage after an applicable step becomes inapplicable", async () => {
  const root = await fixture();
  const completed = await new ExecutionEngine(root).run();
  const persisted = await new StateStore(root).load();

  expect(completed.run.status).toBe("COMPLETED");
  expect(persisted.coverage?.find((lane) => lane.lane === "application-security")).toEqual({
    lane: "application-security",
    status: "UNASSIGNED",
    assigned_capabilities: [],
    blocking: true
  });
}, 20000);
