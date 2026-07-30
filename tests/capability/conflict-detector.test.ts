import { describe, expect, test } from "bun:test";

import {
  detectCapabilityConflicts,
  type CapabilityDeclaration
} from "../../src/capability/conflict-detector.ts";

function declaration(overrides: Partial<CapabilityDeclaration> = {}): CapabilityDeclaration {
  return {
    id: "scanner-a",
    stepId: "scan-a",
    stageId: "security",
    stageExecution: "SEQUENTIAL",
    responsibility: "Detect application security findings.",
    version: "1.0.0",
    writeScopes: [],
    platforms: ["claude_code", "codex", "gemini_cli"],
    ...overrides
  };
}

describe("CAP-007 capability conflict detection", () => {
  test("detects incompatible exact versions for one declared capability", () => {
    const conflicts = detectCapabilityConflicts([
      declaration({ stepId: "scan-old", version: "1.0.0" }),
      declaration({ stepId: "scan-new", version: "2.0.0" })
    ], "codex");

    expect(conflicts).toEqual([{
      type: "INCOMPATIBLE_VERSIONS",
      blocking: true,
      capabilityIds: ["scanner-a"],
      stepIds: ["scan-new", "scan-old"],
      detail: "Capability scanner-a declares incompatible versions: 1.0.0, 2.0.0"
    }]);
  });

  test("detects duplicate normalized responsibility across different capabilities", () => {
    const conflicts = detectCapabilityConflicts([
      declaration(),
      declaration({
        id: "scanner-b",
        stepId: "scan-b",
        responsibility: "  detect   application SECURITY findings. "
      })
    ], "codex");

    expect(conflicts).toEqual([{
      type: "DUPLICATE_RESPONSIBILITY",
      blocking: true,
      capabilityIds: ["scanner-a", "scanner-b"],
      stepIds: ["scan-a", "scan-b"],
      detail: "Multiple capabilities declare the same responsibility: Detect application security findings."
    }]);
  });

  test("detects overlapping writes only inside the same parallel stage", () => {
    const conflicts = detectCapabilityConflicts([
      declaration({
        stepId: "write-src",
        stageId: "repair",
        stageExecution: "PARALLEL",
        responsibility: "Repair source files.",
        writeScopes: ["src/**"]
      }),
      declaration({
        id: "formatter",
        stepId: "format-app",
        stageId: "repair",
        stageExecution: "PARALLEL",
        responsibility: "Format application files.",
        writeScopes: ["src/app/**"]
      }),
      declaration({
        id: "docs-writer",
        stepId: "write-docs",
        stageId: "documentation",
        stageExecution: "PARALLEL",
        responsibility: "Write documentation.",
        writeScopes: ["src/**"]
      })
    ], "codex");

    expect(conflicts).toEqual([{
      type: "OVERLAPPING_PARALLEL_WRITES",
      blocking: true,
      capabilityIds: ["formatter", "scanner-a"],
      stepIds: ["format-app", "write-src"],
      detail: "Parallel steps format-app and write-src have overlapping write scopes: src/** <> src/app/**"
    }]);
  });

  test("does not report disjoint wildcard write scopes as overlapping", () => {
    const conflicts = detectCapabilityConflicts([
      declaration({
        stepId: "write-ts",
        stageId: "repair",
        stageExecution: "PARALLEL",
        responsibility: "Write TypeScript files.",
        writeScopes: ["src/*.ts"]
      }),
      declaration({
        id: "json-writer",
        stepId: "write-json",
        stageId: "repair",
        stageExecution: "PARALLEL",
        responsibility: "Write JSON files.",
        writeScopes: ["src/*.json"]
      })
    ], "codex");

    expect(conflicts).toEqual([]);
  });

  test("detects platform incompatibility without choosing a substitute", () => {
    const conflicts = detectCapabilityConflicts([
      declaration({ platforms: ["claude_code"] })
    ], "codex");

    expect(conflicts).toEqual([{
      type: "PLATFORM_INCOMPATIBLE",
      blocking: true,
      capabilityIds: ["scanner-a"],
      stepIds: ["scan-a"],
      detail: "Capability scanner-a does not declare support for platform codex"
    }]);
  });

  test("returns conflicts in stable type and participant order", () => {
    const conflicts = detectCapabilityConflicts([
      declaration({ stepId: "z-step", version: "2.0.0", platforms: ["claude_code"] }),
      declaration({ stepId: "a-step", version: "1.0.0", platforms: ["claude_code"] })
    ], "codex");

    expect(conflicts.map((conflict) => conflict.type)).toEqual([
      "INCOMPATIBLE_VERSIONS",
      "PLATFORM_INCOMPATIBLE",
      "PLATFORM_INCOMPATIBLE"
    ]);
    expect(conflicts.map((conflict) => conflict.stepIds)).toEqual([
      ["a-step", "z-step"],
      ["a-step"],
      ["z-step"]
    ]);
  });
});
