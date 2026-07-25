import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { recordApproval } from "../src/approvals/approval-store.ts";
import { ExecutionEngine } from "../src/engine/execution-engine.ts";
import { readFinding, listFindings } from "../src/findings/finding-store.ts";

const roots: string[] = [];

async function run(root: string, command: string[]): Promise<void> {
  const child = Bun.spawn(command, { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed (${exitCode})\n${stdout}\n${stderr}`);
  }
}

async function fixture(remediation: "good" | "suppression", approval: "BEFORE_EACH_FIX" | "NEVER"): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-m3-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));

  await writeFile(
    join(root, "src/query.ts"),
    "export function buildQuery(name: string) {\n  return `SELECT * FROM users WHERE name = '${name}'`;\n}\n"
  );
  await writeFile(
    join(root, "tests/query.test.ts"),
    "import { expect, test } from 'bun:test';\nimport { buildQuery } from '../src/query.ts';\ntest('uses a parameterized query', () => {\n  expect(buildQuery(\"O'Reilly\")).toEqual({ text: 'SELECT * FROM users WHERE name = $1', values: [\"O'Reilly\"] });\n});\n"
  );
  await writeFile(
    join(root, "scripts/analyze.ts"),
    "import { readFile, writeFile } from 'node:fs/promises';\nconst source = await readFile('src/query.ts', 'utf8');\nconst output = process.env.DOKION_OUTPUT;\nif (!output) throw new Error('DOKION_OUTPUT is required');\nconst findings = source.includes(\"WHERE name = '${name}'\") ? [{ severity: 'HIGH', title: 'SQL query interpolates user input', description: 'The query embeds a user-controlled name directly in SQL.', rule_id: 'fixture.sql-interpolation', location: { file: 'src/query.ts', line: 2 }, proposed_fix: { summary: 'Use a parameterized query', risk: 'LOW', effort: 'SMALL', touches_files: ['src/query.ts', 'tests/query.test.ts'] }, blocks_release: true }] : [];\nawait writeFile(output, JSON.stringify({ version: 1, findings }, null, 2));\n"
  );
  await writeFile(
    join(root, "scripts/fix-good.ts"),
    "import { writeFile } from 'node:fs/promises';\nif (!process.env.DOKION_FINDING_FILE) throw new Error('DOKION_FINDING_FILE is required');\nawait writeFile('src/query.ts', \"export function buildQuery(name: string) {\\n  return { text: 'SELECT * FROM users WHERE name = $1', values: [name] };\\n}\\n\");\n"
  );
  await writeFile(
    join(root, "scripts/fix-suppression.ts"),
    "import { readFile, writeFile } from 'node:fs/promises';\nif (!process.env.DOKION_FINDING_FILE) throw new Error('DOKION_FINDING_FILE is required');\nconst source = await readFile('src/query.ts', 'utf8');\nawait writeFile('src/query.ts', `// nosec\\n${source}`);\n"
  );

  const analyzer = "bun scripts/analyze.ts";
  const fixer = remediation === "good" ? "bun scripts/fix-good.ts" : "bun scripts/fix-suppression.ts";
  const digest = (character: string) => `sha256:${character.repeat(64)}`;
  const playbook = {
    $schema: "../schemas/dokion-playbook.schema.json",
    version: "1.0.0",
    project: { name: "m3-fixture", target: "READY_FOR_STAGING" },
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
      approval: "BEFORE_WRITE",
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
        name: "Security",
        execution: "SEQUENTIAL",
        steps: [
          {
            id: "security-review",
            capability: { type: "command", id: "fixture-analyzer", version: "1.0.0", immutable_reference: digest("a") },
            responsibility: "Find direct SQL interpolation.",
            mode: "ANALYZE",
            required: true,
            permissions: { read: ["src/**"], write: [".dokion/**", "HARDENING.md"], network: false, shell: [analyzer] },
            approval: "NEVER",
            validation: { require_evidence_artifact: true },
            failure_policy: "STOP_PIPELINE"
          },
          {
            id: "security-fixes",
            capability: { type: "command", id: "fixture-remediator", version: "1.0.0", immutable_reference: digest("b") },
            responsibility: "Repair findings emitted by security-review.",
            mode: remediation === "good" ? "FIX_WITH_APPROVAL" : "FIX_AUTOMATICALLY",
            required: true,
            depends_on: ["security-review"],
            permissions: { read: ["**/*"], write: ["src/**", "tests/**", ".dokion/**", "HARDENING.md"], network: false, shell: [fixer, "bun test"] },
            approval,
            validation: {
              adversarial_verification: true,
              suppression_detection: true,
              require_regression_test: true,
              require_evidence_artifact: true,
              forbid_test_deletion: true,
              forbid_out_of_scope_edits: true,
              max_diff_lines: 100
            },
            verification: ["bun test"],
            success_conditions: ["all_source_findings_verified"],
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

describe("M3 capability findings and remediation", () => {
  test("pauses for finding approval, resumes, repairs, verifies, and records before/after evidence", async () => {
    const root = await fixture("good", "BEFORE_EACH_FIX");
    const awaiting = await new ExecutionEngine(root).run();
    expect(awaiting.run.status).toBe("AWAITING_USER");

    const [finding] = await listFindings(root);
    expect(finding?.status).toBe("OPEN");
    expect(finding?.evidence.some((item) => item.phase === "BEFORE")).toBe(true);

    await recordApproval(root, {
      subject: `finding:${finding!.id}`,
      subjectType: "finding",
      decision: "APPROVED",
      by: "mamdouh",
      notes: "Approved fixture repair"
    });

    const completed = await new ExecutionEngine(root).resume();
    expect(completed.run.status).toBe("COMPLETED");

    const verified = await readFinding(root, finding!.id);
    expect(verified.status).toBe("VERIFIED");
    expect(verified.resolution?.adversary_verdict).toBe("FIX_HOLDS");
    expect(verified.evidence.some((item) => item.phase === "AFTER" && item.kind === "diff")).toBe(true);
    expect(verified.evidence.some((item) => item.phase === "AFTER" && item.kind === "test_result")).toBe(true);
    expect(await readFile(join(root, "src/query.ts"), "utf8")).toContain("values: [name]");
  }, 20000);

  test("rejects and rolls back a suppression repair", async () => {
    const root = await fixture("suppression", "NEVER");
    const state = await new ExecutionEngine(root).run();
    expect(state.run.status).toBe("FAILED");

    const [finding] = await listFindings(root);
    expect(finding?.status).toBe("REPAIR_REJECTED");
    expect(finding?.resolution?.adversary_verdict).toBe("FIX_IS_SUPPRESSION");
    expect(await readFile(join(root, "src/query.ts"), "utf8")).not.toContain("// nosec");
  }, 20000);
});
