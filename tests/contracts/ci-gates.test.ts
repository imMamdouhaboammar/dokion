import { describe, test, expect } from "bun:test";
import { verifyCiQualityGates } from "../../src/contracts/ci-gates";

describe("PROD-012 Required CI Quality Gates", () => {
  test("validates required CI jobs and quality gate configurations", () => {
    const result = verifyCiQualityGates();
    expect(result.valid).toBe(true);
    expect(result.requiredJobs).toContain("contracts");
    expect(result.requiredJobs).toContain("unit-tests");
    expect(result.requiredJobs).toContain("distribution");
  });

  test("keeps CI diagnostic logs outside the release candidate worktree", async () => {
    const workflow = await Bun.file(".github/workflows/ci.yml").text();

    for (const log of [
      "test.log",
      "typecheck.log",
      "distribution.log",
      "package-smoke.log",
      "gemini-extension.log",
    ]) {
      expect(workflow).toContain(`$RUNNER_TEMP/${log}`);
      expect(workflow).not.toContain(`tee ${log}`);
      expect(workflow).not.toContain(`tee \"$GITHUB_WORKSPACE/${log}\"`);
    }
  });
});
