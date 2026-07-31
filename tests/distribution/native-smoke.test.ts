import { describe, test, expect } from "bun:test";
import { runNativeSmokeMatrix } from "../../src/distribution/native-smoke";

describe("PROD-007 Native Package and Binary Smoke Matrices", () => {
  test("executes native smoke tests across host platforms and architectures", () => {
    const result = runNativeSmokeMatrix({
      targetPlatforms: ["darwin-arm64", "darwin-x64", "linux-x64", "win32-x64"],
      packageArchive: "dist/dokion-v1.0.0.tgz",
    });

    expect(result.allPassed).toBe(true);
    expect(result.testedPlatforms).toContain("darwin-arm64");
    expect(result.testedPlatforms).toContain("linux-x64");
  });
});
