import { describe, test, expect } from "bun:test";
import { verifyOnboardingDocs } from "../../src/docs/onboarding-verifier";

describe("PROD-010 Onboarding, Recovery, and Limitations Documentation", () => {
  test("verifies that onboarding documentation exists and contains tested CLI flows", async () => {
    const verification = await verifyOnboardingDocs();
    expect(verification.onboardingDocExists).toBe(true);
    expect(verification.recoveryDocExists).toBe(true);
    expect(verification.testedCommandsCount).toBeGreaterThanOrEqual(5);
  });
});
