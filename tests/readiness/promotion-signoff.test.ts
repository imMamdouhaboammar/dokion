import { describe, test, expect } from "bun:test";
import { generatePromotionSignoffRecord } from "../../src/readiness/promotion-signoff";

describe("EVID-012 Automated Promotion Sign-Off Record", () => {
  test("generates schema-valid promotion-signoff.json with cryptographic digests when all gates pass", () => {
    const input = {
      version: "1.0.0",
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      claimedSurfaces: ["web-fullstack", "api-service", "library-package"],
      playbookDigest: "sha256-playbook-1234567890abcdef",
      lockDigest: "sha256-lock-1234567890abcdef",
      gates: [
        { id: "PG-001", status: "PASS" as const, digest: "sha256-pg1" },
        { id: "PG-002", status: "PASS" as const, digest: "sha256-pg2" },
        { id: "PG-003", status: "PASS" as const, digest: "sha256-pg3" },
        { id: "PG-004", status: "PASS" as const, digest: "sha256-pg4" },
        { id: "PG-005", status: "PASS" as const, digest: "sha256-pg5" },
        { id: "PG-006", status: "PASS" as const, digest: "sha256-pg6" },
        { id: "PG-007", status: "PASS" as const, digest: "sha256-pg7" },
        { id: "PG-008", status: "PASS" as const, digest: "sha256-pg8" },
        { id: "PG-009", status: "PASS" as const, digest: "sha256-pg9" },
        { id: "PG-010", status: "PASS" as const, digest: "sha256-pg10" },
        { id: "PG-011", status: "PASS" as const, digest: "sha256-pg11" },
        { id: "PG-012", status: "PASS" as const, digest: "sha256-pg12" },
      ],
      reviewer: "Dokion Enterprise Gatekeeper",
    };

    const record = generatePromotionSignoffRecord(input);
    expect(record.promotionReady).toBe(true);
    expect(record.signoffDigest).toContain("sha256:");
    expect(record.schemaVersion).toBe("1.0.0");
  });

  test("rejects sign-off if any promotion gate is failing or missing", () => {
    const input = {
      version: "1.0.0",
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      claimedSurfaces: ["web-fullstack"],
      playbookDigest: "sha256-playbook-1234567890abcdef",
      lockDigest: "sha256-lock-1234567890abcdef",
      gates: [
        { id: "PG-001", status: "PASS" as const, digest: "sha256-pg1" },
        { id: "PG-002", status: "FAIL" as const, digest: "sha256-pg2" }, // FAIL
      ],
      reviewer: "Dokion Enterprise Gatekeeper",
    };

    expect(() => generatePromotionSignoffRecord(input)).toThrow("Cannot generate promotion sign-off: promotion gate PG-002 did not pass");
  });
});
