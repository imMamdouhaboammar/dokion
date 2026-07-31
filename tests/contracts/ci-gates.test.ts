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
});
