import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import { resolveCommandStrategy } from "../../src/execution/command-strategy.ts";

describe("EXEC-001 platform command strategy", () => {
  test("uses direct argument-vector execution on macOS and Linux", () => {
    for (const platform of ["darwin", "linux"] as const) {
      expect(resolveCommandStrategy(platform, {
        kind: "ARGV",
        executable: "bun",
        args: ["test", "tests/unit.test.ts"]
      })).toEqual({
        supported: true,
        platform,
        strategy: "DIRECT_ARGV",
        spawnArgv: ["bun", "test", "tests/unit.test.ts"],
        shellParsing: false,
        processGroup: "POSIX_NEW_GROUP",
        degradations: []
      });
    }
  });

  test("uses an explicit POSIX shell only for declared legacy shell text", () => {
    const result = resolveCommandStrategy("linux", {
      kind: "SHELL",
      command: "bun test && bun run typecheck"
    });

    expect(result).toEqual({
      supported: true,
      platform: "linux",
      strategy: "POSIX_SHELL",
      spawnArgv: ["/bin/sh", "-c", "bun test && bun run typecheck"],
      shellParsing: true,
      processGroup: "POSIX_NEW_GROUP",
      degradations: ["LEGACY_SHELL_COMMAND"]
    });
  });

  test("fails closed for Windows and unknown platforms without shell fallback", () => {
    for (const platform of ["win32", "freebsd"] as const) {
      const result = resolveCommandStrategy(platform, {
        kind: "SHELL",
        command: "echo unsafe"
      });

      expect(result).toEqual({
        supported: false,
        platform,
        strategy: "UNSUPPORTED",
        shellParsing: false,
        processGroup: "UNSUPPORTED",
        degradations: ["UNPROVEN_PLATFORM_COMMAND_STRATEGY"],
        reason: `No proven command strategy exists for platform ${platform}`
      });
      expect("spawnArgv" in result).toBe(false);
    }
  });

  test("does not reinterpret argument-vector values as shell syntax", () => {
    const result = resolveCommandStrategy("darwin", {
      kind: "ARGV",
      executable: "printf",
      args: ["%s", "$(touch should-not-run)", "a; echo b"]
    });

    expect(result.supported).toBe(true);
    if (!result.supported) throw new Error("expected supported strategy");
    expect(result.spawnArgv).toEqual([
      "printf",
      "%s",
      "$(touch should-not-run)",
      "a; echo b"
    ]);
    expect(result.shellParsing).toBe(false);
  });

  test("rejects malformed command declarations before strategy selection", () => {
    expect(() => resolveCommandStrategy("linux", {
      kind: "ARGV",
      executable: "",
      args: []
    })).toThrow(DokionError);
    expect(() => resolveCommandStrategy("linux", {
      kind: "ARGV",
      executable: "bun\u0000evil",
      args: []
    })).toThrow(DokionError);
    expect(() => resolveCommandStrategy("linux", {
      kind: "SHELL",
      command: "   "
    })).toThrow(DokionError);
  });
});
