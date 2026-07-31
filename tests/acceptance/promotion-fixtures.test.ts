import { describe, test, expect } from "bun:test";
import { verifyPromotionFixtures } from "../../src/acceptance/promotion-fixtures";

describe("PROD-011 Seeded Demo Repositories and Promotion Fixtures", () => {
  test("resets and validates seeded web, API, and library promotion fixtures", () => {
    const verification = verifyPromotionFixtures();
    expect(verification.webFullstackFixturePassed).toBe(true);
    expect(verification.apiServiceFixturePassed).toBe(true);
    expect(verification.libraryPackageFixturePassed).toBe(true);
  });
});
