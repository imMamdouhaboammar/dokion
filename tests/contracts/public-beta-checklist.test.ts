import { describe, test, expect } from "bun:test";
import { verifyPublicBetaChecklist } from "../../src/contracts/public-beta-checklist";

describe("PROD-014 Public Beta Launch Checklist Contract", () => {
  test("verifies that all launch promotion requirements and claims are satisfied", () => {
    const checklist = verifyPublicBetaChecklist();
    expect(checklist.readyForPublicBeta).toBe(true);
    expect(checklist.unresolvedP0Defects).toBe(0);
    expect(checklist.unresolvedP1Defects).toBe(0);
    expect(checklist.claimsVerified).toBe(true);
  });
});
