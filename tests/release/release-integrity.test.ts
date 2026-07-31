import { describe, test, expect } from "bun:test";
import { verifyReleaseIntegrity } from "../../src/release/release-integrity";

describe("PROD-013 Supply-Chain and Release Evidence Integrity", () => {
  test("verifies package tarball checksums, SBOM, and version sync", () => {
    const integrity = verifyReleaseIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.versionSynced).toBe(true);
    expect(integrity.checksumsPresent).toBe(true);
  });
});
