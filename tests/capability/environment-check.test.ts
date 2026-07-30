import { describe, expect, test } from "bun:test";

import {
  checkEnvironmentPrerequisites,
  type EnvironmentRequirement
} from "../../src/capability/environment-check.ts";

const requirements: EnvironmentRequirement[] = [
  { name: "SAFE_TOKEN", required: true, pattern: "^tok_[A-Za-z0-9]+$" },
  { name: "MODE", required: true, allowedValues: ["audit", "verify"] },
  { name: "OPTIONAL_REGION", required: false, pattern: "^[a-z]{2}-[a-z]+-[0-9]$" }
];

describe("CAP-006 environment prerequisite audit", () => {
  test("validates declared shapes without returning raw values", () => {
    const result = checkEnvironmentPrerequisites(requirements, {
      SAFE_TOKEN: "tok_supersecret123",
      MODE: "audit",
      OPTIONAL_REGION: "eu-west-1",
      UNDECLARED_SECRET: "must-not-appear"
    });

    expect(result.valid).toBe(true);
    expect(result.checks.map(({ name, status, present }) => ({ name, status, present }))).toEqual([
      { name: "MODE", status: "PASS", present: true },
      { name: "OPTIONAL_REGION", status: "PASS", present: true },
      { name: "SAFE_TOKEN", status: "PASS", present: true }
    ]);
    expect(result.allowedNames).toEqual(["MODE", "OPTIONAL_REGION", "SAFE_TOKEN"]);
    expect(JSON.stringify(result)).not.toContain("tok_supersecret123");
    expect(JSON.stringify(result)).not.toContain("must-not-appear");
  });

  test("fails closed for missing and malformed required values", () => {
    const result = checkEnvironmentPrerequisites(requirements, {
      MODE: "ship",
      OPTIONAL_REGION: "invalid-region"
    });

    expect(result.valid).toBe(false);
    expect(result.checks).toEqual([
      {
        name: "MODE",
        status: "INVALID",
        present: true,
        redacted: true,
        reason: "value is not in the declared allowlist"
      },
      {
        name: "OPTIONAL_REGION",
        status: "INVALID",
        present: true,
        redacted: true,
        reason: "value does not match the declared pattern"
      },
      {
        name: "SAFE_TOKEN",
        status: "MISSING",
        present: false,
        redacted: true,
        reason: "required environment variable is missing"
      }
    ]);
  });

  test("allows an absent optional variable without widening the child environment", () => {
    const result = checkEnvironmentPrerequisites(
      [{ name: "OPTIONAL_REGION", required: false }],
      { OTHER: "secret" }
    );

    expect(result).toEqual({
      valid: true,
      allowedNames: [],
      checks: [{
        name: "OPTIONAL_REGION",
        status: "PASS",
        present: false,
        redacted: true,
        reason: "optional environment variable is not present"
      }]
    });
  });

  test("denies dangerous loader variables even when declared", () => {
    const result = checkEnvironmentPrerequisites(
      [
        { name: "LD_PRELOAD", required: true },
        { name: "NODE_OPTIONS", required: false }
      ],
      {
        LD_PRELOAD: "/tmp/evil.so",
        NODE_OPTIONS: "--require injected.js"
      }
    );

    expect(result.valid).toBe(false);
    expect(result.allowedNames).toEqual([]);
    expect(result.checks).toEqual([
      {
        name: "LD_PRELOAD",
        status: "DENIED",
        present: true,
        redacted: true,
        reason: "dangerous loader environment variable is denied"
      },
      {
        name: "NODE_OPTIONS",
        status: "DENIED",
        present: true,
        redacted: true,
        reason: "dangerous loader environment variable is denied"
      }
    ]);
  });

  test("returns deterministic invalid results for malformed requirement declarations", () => {
    const result = checkEnvironmentPrerequisites(
      [
        { name: "lowercase-name", required: true },
        { name: "BROKEN_PATTERN", pattern: "[" }
      ],
      { "lowercase-name": "value", BROKEN_PATTERN: "value" }
    );

    expect(result.valid).toBe(false);
    expect(result.allowedNames).toEqual([]);
    expect(result.checks.map((check) => ({ name: check.name, status: check.status, reason: check.reason }))).toEqual([
      { name: "BROKEN_PATTERN", status: "INVALID", reason: "declared pattern is invalid" },
      { name: "lowercase-name", status: "INVALID", reason: "environment variable name is invalid" }
    ]);
  });
});
