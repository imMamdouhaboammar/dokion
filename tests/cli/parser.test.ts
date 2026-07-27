import { describe, expect, test } from "bun:test";

import { parseCliInvocation } from "../../src/cli/parser.ts";
import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";

const root = process.cwd();

function expectDokionError(action: () => unknown, code: DokionErrorCode): DokionError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
  throw new Error(`Expected ${code}`);
}

async function runCli(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, "run", "src/cli.ts", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  return { exitCode, stdout, stderr };
}

describe("typed CLI argument parser", () => {
  test("parses implemented boolean and decision options", () => {
    expect(parseCliInvocation(["validate", "--catalog-only"])).toEqual({
      command: "validate",
      catalogOnly: true
    });

    expect(parseCliInvocation(["approve", "finding:DK-1", "--by", "mamdouh", "--notes", "Scoped repair"])).toEqual({
      command: "approve",
      subject: "finding:DK-1",
      subjectType: "finding",
      by: "mamdouh",
      notes: "Scoped repair"
    });
  });

  test("rejects unknown options with a stable error code", () => {
    const error = expectDokionError(
      () => parseCliInvocation(["status", "--verbose"]),
      "CLI_UNKNOWN_OPTION"
    );
    expect(error.details).toEqual({ command: "status", option: "--verbose" });
  });

  test("rejects missing and duplicate singular option values", () => {
    expectDokionError(
      () => parseCliInvocation(["approve", "finding:DK-1", "--by"]),
      "CLI_MISSING_OPTION_VALUE"
    );
    expectDokionError(
      () => parseCliInvocation(["approve", "finding:DK-1", "--by", "one", "--by", "two"]),
      "CLI_DUPLICATE_OPTION"
    );
  });

  test("rejects malformed approval subjects", () => {
    const missingIdentifier = expectDokionError(
      () => parseCliInvocation(["approve", "finding:", "--by", "mamdouh"]),
      "CLI_INVALID_ARGUMENT"
    );
    expect(missingIdentifier.details).toMatchObject({ argument: "subject" });

    expectDokionError(
      () => parseCliInvocation(["reject", "unknown:DK-1", "--by", "mamdouh"]),
      "CLI_INVALID_ARGUMENT"
    );
  });

  test("renders parser failures as JSON without stack traces", async () => {
    const result = await runCli("approve", "not-a-subject", "--by", "mamdouh");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: "CLI_INVALID_ARGUMENT",
      details: { command: "approve", argument: "subject" }
    });
    expect(result.stderr).not.toContain(" at ");
    expect(result.stderr).not.toContain("src/cli.ts:");
  });
});
