import { describe, expect, test } from "bun:test";

import {
  clearSchemaRegistryCache,
  validatePlaybookData
} from "../../src/contracts/schema-validator.ts";
import { DokionError } from "../../src/core/errors.ts";
import { normalizeCommandSpec } from "../../src/execution/command-spec.ts";

const pinned = `sha256:${"a".repeat(64)}`;

function playbook(command: unknown) {
  return {
    version: "1.0.0",
    project: { name: "command-spec" },
    authority: { capability_selection: "USER_ONLY", execution_order: "USER_ONLY" },
    stages: [{
      id: "verify",
      execution: "SEQUENTIAL",
      steps: [{
        id: "test",
        capability: { type: "command", id: "bun", immutable_reference: pinned },
        responsibility: "Run tests.",
        mode: "VERIFY_ONLY",
        verification: [command]
      }]
    }],
    release_gates: [{ id: "test-gate", command, blocking: true }]
  };
}

describe("EXEC-002 command specification", () => {
  test("normalizes argument vectors without shell interpretation", () => {
    const input = {
      executable: "printf",
      args: ["%s", "$(touch should-not-run)", "a; echo b"]
    };
    const result = normalizeCommandSpec(input);
    input.args[1] = "mutated";

    expect(result).toEqual({
      schema_version: 1,
      kind: "ARGV",
      identity: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      executable: "printf",
      args: ["%s", "$(touch should-not-run)", "a; echo b"],
      risk: "LOWER",
      degradations: [],
      evidence: {
        executable: "printf",
        args: ["%s", "$(touch should-not-run)", "a; echo b"]
      }
    });
  });

  test("retains legacy shell strings as an explicit higher-risk form", () => {
    const result = normalizeCommandSpec("bun test && bun run typecheck");

    expect(result).toEqual({
      schema_version: 1,
      kind: "SHELL",
      identity: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      command: "bun test && bun run typecheck",
      risk: "HIGHER",
      degradations: ["LEGACY_SHELL_COMMAND"],
      evidence: { legacy_shell_command: "bun test && bun run typecheck" }
    });
  });

  test("produces stable identities that change with executable argument order or kind", () => {
    const first = normalizeCommandSpec({ executable: "bun", args: ["test", "a.ts"] });
    const same = normalizeCommandSpec({ executable: "bun", args: ["test", "a.ts"] });
    const reordered = normalizeCommandSpec({ executable: "bun", args: ["a.ts", "test"] });
    const shell = normalizeCommandSpec("bun test a.ts");

    expect(first.identity).toBe(same.identity);
    expect(first.identity).not.toBe(reordered.identity);
    expect(first.identity).not.toBe(shell.identity);
  });

  test("rejects empty mixed and malformed runtime forms", () => {
    const nul = String.fromCharCode(0);
    const invalid: unknown[] = [
      "   ",
      { executable: "", args: [] },
      { executable: `bun${nul}evil`, args: [] },
      { executable: "bun", args: "test" },
      { executable: "bun", args: ["test", 42] },
      { executable: "bun", args: [], command: "bun test" },
      { args: ["test"] },
      null,
      []
    ];

    for (const value of invalid) {
      expect(() => normalizeCommandSpec(value)).toThrow(DokionError);
    }
  });

  test("the playbook schema accepts argv objects and legacy strings", async () => {
    clearSchemaRegistryCache();
    expect(await validatePlaybookData(process.cwd(), playbook({
      executable: "bun",
      args: ["test", "tests/unit.test.ts"]
    }))).toEqual([]);
    expect(await validatePlaybookData(process.cwd(), playbook("bun test"))).toEqual([]);
  });

  test("the playbook schema rejects mixed empty and malformed command forms", async () => {
    const nul = String.fromCharCode(0);
    const invalid: unknown[] = [
      "",
      { executable: "", args: [] },
      { executable: "bun", args: "test" },
      { executable: "bun", args: ["test", 42] },
      { executable: "bun", args: [], command: "bun test" },
      { executable: `bun${nul}evil`, args: [] },
      { executable: "bun", args: [`test${nul}evil`] },
      `bun${nul}test`,
      { args: ["test"] }
    ];

    for (const command of invalid) {
      clearSchemaRegistryCache();
      expect(await validatePlaybookData(process.cwd(), playbook(command))).not.toEqual([]);
    }
  });
});
