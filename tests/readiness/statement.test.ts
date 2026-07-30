import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import {
  formatReadinessStatement,
  type QualifiedReadinessInput
} from "../../src/readiness/readiness-statement.ts";

const digest = (character: string): string => `sha256:${character.repeat(64)}`;

function input(): QualifiedReadinessInput {
  return {
    subject: "repository fixture",
    status: "READY_FOR_PRODUCTION" as const,
    repositoryCommit: "0123456789abcdef",
    playbookDigest: digest("a"),
    capabilityLockDigest: digest("b"),
    gates: [
      { id: "z-gate", status: "PASS" as const, blocking: true },
      { id: "a-gate", status: "PASS" as const, blocking: true }
    ],
    coverage: [
      { lane: "supply-chain", status: "ASSIGNED" as const, blocking: true },
      { lane: "mobile-native", status: "UNASSIGNED" as const, blocking: false }
    ],
    degradations: ["NO_WORKTREE_ISOLATION", "NO_HOOK_ENFORCEMENT"] as const,
    exclusions: ["windows-native", "mobile-native-security"],
    evaluatedAt: "2026-07-30T19:30:00.000Z"
  };
}

describe("qualified readiness statement", () => {
  test("binds a production result to exact evidence and sorted limitations", () => {
    const result = formatReadinessStatement(input());

    expect(result.status).toBe("READY_FOR_PRODUCTION");
    expect(result.repository_commit).toBe("0123456789abcdef");
    expect(result.playbook_digest).toBe(digest("a"));
    expect(result.capability_lock_digest).toBe(digest("b"));
    expect(result.blocking_gate_failures).toEqual([]);
    expect(result.degradations).toEqual(["NO_HOOK_ENFORCEMENT", "NO_WORKTREE_ISOLATION"]);
    expect(result.exclusions).toEqual(["mobile-native-security", "windows-native"]);
    expect(result.statement).toContain("repository fixture");
    expect(result.statement).toContain("0123456789abcdef");
    expect(result.statement).toContain(digest("a"));
    expect(result.statement).toContain(digest("b"));
    expect(result.statement).toContain("NO_HOOK_ENFORCEMENT");
    expect(result.statement).toContain("mobile-native-security");
    expect(result.statement).toContain("scoped Dokion result");
    expect(result.statement.toLowerCase()).not.toBe("production ready");
  });

  test("records failed blocking gates and uncovered blocking lanes", () => {
    const configured: QualifiedReadinessInput = {
      ...input(),
      status: "NOT_READY",
      gates: [
        { id: "z-gate", status: "FAIL", blocking: true },
        { id: "a-gate", status: "PASS", blocking: true }
      ],
      coverage: [
        { lane: "supply-chain", status: "PARTIAL", blocking: true },
        { lane: "mobile-native", status: "UNASSIGNED", blocking: false }
      ]
    };

    const result = formatReadinessStatement(configured);

    expect(result.blocking_gate_failures).toEqual(["z-gate"]);
    expect(result.uncovered_blocking_lanes).toEqual(["supply-chain"]);
    expect(result.statement).toContain("NOT_READY");
    expect(result.statement).toContain("No completion claim is active");
  });

  test("rejects a ready status when blocking evidence disagrees", () => {
    const configured: QualifiedReadinessInput = {
      ...input(),
      gates: [{ id: "blocking-gate", status: "FAIL", blocking: true }]
    };

    expect(() => formatReadinessStatement(configured)).toThrow(DokionError);
  });

  test("rejects a readiness input that is not tied to immutable identifiers", () => {
    const configured = input();
    configured.capabilityLockDigest = "";

    expect(() => formatReadinessStatement(configured)).toThrow(DokionError);
  });
});
