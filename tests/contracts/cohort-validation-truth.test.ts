import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const root = process.cwd();
const cohortScript = join(root, "scripts", "validate-cohort-adoption.ts");

describe("external cohort validation truth boundary", () => {
  test("never reports repository success without executing a repository command", async () => {
    const file = Bun.file(cohortScript);
    if (!(await file.exists())) return;

    const source = await file.text();
    expect(source).not.toContain("... SUCCESS");
    expect(source).not.toContain("All 10 cohort repositories passed");
    expect(source).toMatch(/Bun\.spawn|spawn\(/);
    expect(source).toMatch(/exitCode|\.exited/);
  });
});
