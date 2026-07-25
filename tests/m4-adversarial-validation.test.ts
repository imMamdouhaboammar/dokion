import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  captureRepairSnapshot,
  diffRepairSnapshots,
  restoreRepairSnapshot
} from "../src/validation/repair-snapshot.ts";
import { validateRepair } from "../src/validation/repair-validator.ts";

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

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-m4-"));
  roots.push(root);
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });
  await writeFile(join(root, "src/query.ts"), "export const query = 'unsafe';\n");
  await writeFile(join(root, "tests/query.test.ts"), "import { test } from 'bun:test';\ntest('existing coverage', () => {});\n");
  await writeFile(join(root, "notes.txt"), "baseline notes\n");
  await run(root, ["git", "init"]);
  await run(root, ["git", "config", "user.email", "dokion@example.invalid"]);
  await run(root, ["git", "config", "user.name", "Dokion Test"]);
  await run(root, ["git", "add", "."]);
  await run(root, ["git", "commit", "-m", "baseline"]);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("M4 repair snapshots", () => {
  test("detects an untracked out-of-scope file", async () => {
    const root = await repository();
    const before = await captureRepairSnapshot(root);
    await writeFile(join(root, "outside.txt"), "created by repair\n");

    const result = await validateRepair({
      root,
      runId: "run-m4",
      findingId: "DK-APPSEC-001",
      writeScopes: ["src/**", "tests/**"],
      policy: { forbid_out_of_scope_edits: true },
      before
    });

    expect(result.verdict).toBe("FIX_INCOMPLETE");
    expect(result.changedPaths).toContain("outside.txt");
    expect(result.violations).toContain("out-of-scope edit: outside.txt");
  });

  test("detects a suppression directive in an untracked file", async () => {
    const root = await repository();
    const before = await captureRepairSnapshot(root);
    await writeFile(join(root, "src/escape.ts"), "// nosec\nexport const escaped = true;\n");

    const result = await validateRepair({
      root,
      runId: "run-m4",
      findingId: "DK-APPSEC-002",
      writeScopes: ["src/**"],
      policy: { suppression_detection: true },
      before
    });

    expect(result.verdict).toBe("FIX_IS_SUPPRESSION");
    expect(result.changedPaths).toContain("src/escape.ts");
    expect(result.violations).toContain("suppression directive added: nosec");
  });

  test("restores the exact pre-repair tree and preserves unrelated dirty work", async () => {
    const root = await repository();
    await writeFile(join(root, "notes.txt"), "user dirty notes\n");
    const before = await captureRepairSnapshot(root);

    await writeFile(join(root, "src/query.ts"), "export const query = 'fake fix';\n");
    await writeFile(join(root, "src/generated.ts"), "export const generated = true;\n");
    await chmod(join(root, "src/query.ts"), 0o755);
    const after = await captureRepairSnapshot(root);
    const delta = diffRepairSnapshots(before, after);

    await restoreRepairSnapshot(root, before, delta);

    expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("user dirty notes\n");
    expect(await readFile(join(root, "src/query.ts"), "utf8")).toBe("export const query = 'unsafe';\n");
    expect(await Bun.file(join(root, "src/generated.ts")).exists()).toBe(false);
  });

  test("an unchanged historical test does not satisfy require_regression_test", async () => {
    const root = await repository();
    const before = await captureRepairSnapshot(root);
    await writeFile(join(root, "src/query.ts"), "export const query = 'parameterized';\n");

    const result = await validateRepair({
      root,
      runId: "run-m4",
      findingId: "DK-APPSEC-003",
      writeScopes: ["src/**", "tests/**"],
      policy: { require_regression_test: true },
      before
    });

    expect(result.verdict).toBe("FIX_INCOMPLETE");
    expect(result.changedTestPaths).toEqual([]);
    expect(result.violations).toContain("repair did not add or modify a regression test");
  });

  test("a modified test is recorded as regression evidence", async () => {
    const root = await repository();
    const before = await captureRepairSnapshot(root);
    await writeFile(join(root, "src/query.ts"), "export const query = 'parameterized';\n");
    await writeFile(
      join(root, "tests/query.test.ts"),
      "import { expect, test } from 'bun:test';\nimport { query } from '../src/query.ts';\ntest('parameterized query', () => expect(query).toBe('parameterized'));\n"
    );

    const result = await validateRepair({
      root,
      runId: "run-m4",
      findingId: "DK-APPSEC-004",
      writeScopes: ["src/**", "tests/**"],
      policy: { require_regression_test: true },
      before
    });

    expect(result.verdict).toBe("FIX_HOLDS");
    expect(result.changedTestPaths).toEqual(["tests/query.test.ts"]);
  });
});
