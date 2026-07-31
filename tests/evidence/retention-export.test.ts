import { describe, test, expect } from "bun:test";
import { enforceRetentionRules, exportRunBundle, verifyRunBundle } from "../../src/evidence/retention";

describe("EVID-011 Evidence Retention & Export Bundles", () => {
  test("prevents pruning of required evidence retention classes", () => {
    const evidenceList = [
      { id: "ev-001", retentionClass: "PERMANENT" as const, path: "evidence/audit.json" },
      { id: "ev-002", retentionClass: "EPHEMERAL" as const, path: "evidence/tmp-spool.log" },
    ];

    const result = enforceRetentionRules(evidenceList, "EPHEMERAL");
    expect(result.prunedIds).toContain("ev-002");
    expect(result.prunedIds).not.toContain("ev-001");
    expect(result.retainedIds).toContain("ev-001");
  });

  test("exports and verifies portable evidence bundle without credentials or private absolute paths", () => {
    const bundleInput = {
      runId: "run-100",
      commit: "1234567890abcdef1234567890abcdef12345678",
      evidenceItems: [
        { path: "evidence/summary.json", content: '{"status":"PASS"}' },
      ],
    };

    const bundle = exportRunBundle(bundleInput);
    expect(bundle.bundleDigest).toBeDefined();
    expect(bundle.hasSecretKeys).toBe(false);

    const verification = verifyRunBundle(bundle);
    expect(verification.valid).toBe(true);
  });
});
