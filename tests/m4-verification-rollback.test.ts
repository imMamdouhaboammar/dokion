import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import { listFindings } from "../src/findings/finding-store.ts";

const roots: string[] = [];

async function run(root: string, command: string[]): Promise<void> {
  const child = Bun.spawn(command, { cwd: root, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed (${exitCode})\n${stdout}\n${stderr}`);
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-m4-verify-"));
  roots.push(root);
  for (const directory of [".dokion", "src", "tests", "scripts"]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));

  await writeFile(join(root, "src/query.ts"), "export const query = 'unsafe';\n");
  await writeFile(
    join(root, "tests/query.test.ts"),
    "import { expect, test } from 'bun:test';\nimport { query } from '../src/query.ts';\ntest('fixture starts unsafe', () => expect(query).toBe('unsafe'));\n"
  );
  await writeFile(
    join(root, "scripts/analyze.ts"),
    "import { writeFile } from 'node:fs/promises';\nconst output = process.env.DOKION_OUTPUT;\nif (!output) throw new Error('DOKION_OUTPUT is required');\nawait writeFile(output, JSON.stringify({ version: 1, findings: [{ severity: 'HIGH', title: 'Unsafe query', description: 'Fixture defect.', rule_id: 'fixture.unsafe-query', location: { file: 'src/query.ts', line: 1 }, proposed_fix: { summary: 'Replace unsafe query', risk: 'LOW', effort: 'SMALL', touches_files: ['src/query.ts', 'tests/query.test.ts'] }, blocks_release: true }] }, null, 2));\n"
  );
  await writeFile(
    join(root, "scripts/fix.ts"),
    "import { writeFile } from 'node:fs/promises';\nawait writeFile('src/query.ts', \"export const query = 'safe';\\n\");\nawait writeFile('tests/query.test.ts', \"import { expect, test } from 'bun:test';\\nimport { query } from '../src/query.ts';\\ntest('fixture is repaired', () => expect(query).toBe('safe'));\\n\");\n"
  );

  const analyze = "bun scripts/analyze.ts";
  const fix = "bun scripts/fix.ts";
  const failVerification = "bun -e 'process.exit(1)'";
  const digest = (character: string) => `sha256:${character.repeat(64)}`;
  const playbook = {
    $schema: "../schemas/dokion-playbook.schema.json",
    version: "1.0.0",
    project: { name: "verification-rollback", target: "READY_FOR_STAGING" },
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
    registry: { sources: ["dokion.json"], require_verified: true, require_digest: true, on_unverified: "STOP_STEP" },
    defaults: {
      approval: "NEVER",
      failure_policy: "STOP_PIPELINE",
      retry_count: 0,
      maximum_iterations: 1,
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
        id: "security",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "analyze",
            capability: { type: "command", id: "fixture-analyzer", version: "1.0.0", immutable_reference: digest("c") },
            responsibility: "Find the seeded defect.",
            mode: "ANALYZE",
            required: true,
            permissions: { read: ["src/**"], write: [".dokion/**", "HARDENING.md"], network: false, shell: [analyze, "bun test"] },
            approval: "NEVER",
            validation: { require_evidence_artifact: true },
            verification: ["bun test"],
            success_conditions: ["capability_output_recorded", "verification_passed"],
            failure_policy: "STOP_PIPELINE"
          },
          {
            id: "fix",
            capability: { type: "command", id: "fixture-fixer", version: "1.0.0", immutable_reference: digest("d") },
            responsibility: "Repair findings from analyze.",
            mode: "FIX_AUTOMATICALLY",
            required: true,
            depends_on: ["analyze"],
            permissions: {
              read: ["**/*"],
              write: ["src/**", "tests/**", ".dokion/**", "HARDENING.md"],
              network: false,
              shell: [fix, failVerification]
            },
            approval: "NEVER",
            validation: {
              adversarial_verification: true,
              suppression_detection: true,
              require_regression_test: true,
              require_evidence_artifact: true,
              forbid_test_deletion: true,
              forbid_out_of_scope_edits: true,
              max_diff_lines: 100
            },
            verification: [failVerification],
            failure_policy: "STOP_PIPELINE"
          }
        ]
      }
    ],
    release_gates: [],
    manifest: "dokion.json"
  };
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);

  await run(root, ["git", "init"]);
  await run(root, ["git", "config", "user.email", "dokion@example.invalid"]);
  await run(root, ["git", "config", "user.name", "Dokion Test"]);
  await run(root, ["git", "add", "."]);
  await run(root, ["git", "commit", "-m", "fixture baseline"]);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("verification failure restores the exact pre-remediation tree", async () => {
  const root = await fixture();
  const sourceBefore = await readFile(join(root, "src/query.ts"), "utf8");
  const testBefore = await readFile(join(root, "tests/query.test.ts"), "utf8");

  const state = await new ExecutionEngine(root).run();

  expect(state.run.status).toBe("FAILED");
  const [finding] = await listFindings(root);
  expect(finding?.status).toBe("REPAIR_REJECTED");
  expect(finding?.resolution?.adversary_verdict).toBe("FIX_INCOMPLETE");
  expect(await readFile(join(root, "src/query.ts"), "utf8")).toBe(sourceBefore);
  expect(await readFile(join(root, "tests/query.test.ts"), "utf8")).toBe(testBefore);
}, 20000);
