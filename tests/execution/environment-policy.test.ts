import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import { buildChildEnvironment } from "../../src/execution/environment-policy.ts";

function parent() {
  return {
    PATH: "/custom/bin:/usr/bin:/bin",
    LANG: "en_US.UTF-8",
    TMPDIR: "/tmp/dokion/",
    HOME: "/Users/private-home",
    SAFE_TOKEN: "super-secret-token",
    OPTIONAL_REGION: "eu-west-1",
    AWS_SECRET_ACCESS_KEY: "undeclared-aws-secret",
    NODE_OPTIONS: "--require injected.js",
    LD_PRELOAD: "/tmp/evil.so"
  };
}

describe("EXEC-003 child environment policy", () => {
  test("builds a deterministic environment from safe defaults and declared names", () => {
    const result = buildChildEnvironment({
      platform: "darwin",
      parentEnvironment: parent(),
      declaredNames: ["SAFE_TOKEN", "OPTIONAL_REGION", "MISSING_OPTIONAL"],
      runtimeValues: {
        DOKION_RUN_ID: "run-001",
        DOKION_STEP_ID: "scan-a"
      }
    });

    expect(result.supported).toBe(true);
    if (!result.supported) throw new Error("expected supported environment policy");
    expect(result).toEqual({
      supported: true,
      platform: "darwin",
      environment: {
        DOKION_RUN_ID: "run-001",
        DOKION_STEP_ID: "scan-a",
        LANG: "en_US.UTF-8",
        OPTIONAL_REGION: "eu-west-1",
        PATH: "/custom/bin:/usr/bin:/bin",
        SAFE_TOKEN: "super-secret-token",
        TMPDIR: "/tmp/dokion/"
      },
      inheritedNames: ["LANG", "OPTIONAL_REGION", "PATH", "SAFE_TOKEN", "TMPDIR"],
      runtimeNames: ["DOKION_RUN_ID", "DOKION_STEP_ID"],
      missingDeclaredNames: ["MISSING_OPTIONAL"],
      deniedNames: [],
      redactions: [
        { name: "DOKION_RUN_ID", token: "[REDACTED:ENV:DOKION_RUN_ID]" },
        { name: "DOKION_STEP_ID", token: "[REDACTED:ENV:DOKION_STEP_ID]" },
        { name: "OPTIONAL_REGION", token: "[REDACTED:ENV:OPTIONAL_REGION]" },
        { name: "SAFE_TOKEN", token: "[REDACTED:ENV:SAFE_TOKEN]" }
      ],
      degradations: []
    });
    expect(result.environment).not.toHaveProperty("HOME");
    expect(result.environment).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(result.environment).not.toHaveProperty("NODE_OPTIONS");
    expect(JSON.stringify(result.redactions)).not.toContain("super-secret-token");
  });

  test("denies dangerous loader variables even when declared", () => {
    const result = buildChildEnvironment({
      platform: "linux",
      parentEnvironment: parent(),
      declaredNames: ["LD_PRELOAD", "NODE_OPTIONS", "SAFE_TOKEN"]
    });

    expect(result.supported).toBe(true);
    if (!result.supported) throw new Error("expected supported environment policy");
    expect(result.deniedNames).toEqual(["LD_PRELOAD", "NODE_OPTIONS"]);
    expect(result.environment).toEqual({
      LANG: "en_US.UTF-8",
      PATH: "/custom/bin:/usr/bin:/bin",
      SAFE_TOKEN: "super-secret-token",
      TMPDIR: "/tmp/dokion/"
    });
    expect(result.degradations).toEqual(["DECLARED_ENVIRONMENT_VARIABLE_DENIED"]);
  });

  test("uses a bounded PATH fallback and does not inherit HOME", () => {
    const result = buildChildEnvironment({
      platform: "linux",
      parentEnvironment: { HOME: "/root", SECRET: "hidden" },
      declaredNames: []
    });

    expect(result).toEqual({
      supported: true,
      platform: "linux",
      environment: { PATH: "/usr/bin:/bin" },
      inheritedNames: ["PATH"],
      runtimeNames: [],
      missingDeclaredNames: [],
      deniedNames: [],
      redactions: [],
      degradations: ["PATH_FALLBACK_APPLIED"]
    });
  });

  test("rejects runtime namespace abuse malformed names and NUL values", () => {
    const nul = String.fromCharCode(0);
    const invalid = [
      { declaredNames: ["lowercase"], runtimeValues: {} },
      { declaredNames: [], runtimeValues: { SAFE_TOKEN: "secret" } },
      { declaredNames: [], runtimeValues: { DOKION_RUN_ID: `run${nul}evil` } },
      { declaredNames: ["SAFE_TOKEN"], runtimeValues: { DOKION_RUN_ID: "run", SAFE_TOKEN: "override" } }
    ];

    for (const input of invalid) {
      expect(() => buildChildEnvironment({
        platform: "linux",
        parentEnvironment: parent(),
        ...input
      })).toThrow(DokionError);
    }
  });

  test("fails closed on an unproven platform without returning an environment", () => {
    const result = buildChildEnvironment({
      platform: "win32",
      parentEnvironment: parent(),
      declaredNames: ["SAFE_TOKEN"]
    });

    expect(result).toEqual({
      supported: false,
      platform: "win32",
      reason: "No proven child environment policy exists for platform win32",
      degradations: ["UNPROVEN_PLATFORM_ENVIRONMENT_POLICY"]
    });
    expect("environment" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("super-secret-token");
  });
});
