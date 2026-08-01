import { describe, expect, test } from "bun:test";

import { parseCliInvocation } from "../../src/cli/parser.ts";
import { renderCliResult } from "../../src/cli/output.ts";

const root = process.cwd();

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

describe("CLI output selection", () => {
  test("renders deterministic human and JSON output", () => {
    const value = { zeta: 2, alpha: { zeta: true, alpha: "first" } };

    expect(renderCliResult(value, "human")).toBe('alpha: {"alpha":"first","zeta":true}\nzeta: 2');
    expect(renderCliResult(value, "json")).toBe(`{
  "alpha": {
    "alpha": "first",
    "zeta": true
  },
  "zeta": 2
}`);
  });

  test("accepts --format json for every implemented command shape", () => {
    const commands: string[][] = [
      ["help"],
      ["init"],
      ["inspect"],
      ["doctor"],
      ["plan"],
      ["validate"],
      ["run"],
      ["resume"],
      ["verify"],
      ["approve", "finding:DK-1", "--by", "mamdouh"],
      ["reject", "finding:DK-1", "--by", "mamdouh"],
      ["status"],
      ["report"],
      ["findings"],
      ["tools", "list"],
      ["skills", "list"],
      ["plugins", "list"],
      ["loops", "list"]
    ];

    for (const command of commands) {
      expect(parseCliInvocation([...command, "--format", "json"])).toMatchObject({ format: "json" });
    }
  });

  test("uses human output by default and JSON only when requested", async () => {
    const human = await runCli("doctor");
    const json = await runCli("doctor", "--format", "json");
    const parsed = JSON.parse(json.stdout) as { healthy: boolean };

    expect(human.exitCode).toBe(json.exitCode);
    expect(human.stderr).toBe("");
    expect(json.stderr).toBe("");
    expect(typeof parsed.healthy).toBe("boolean");
    expect(human.stdout).toContain(`healthy: ${parsed.healthy}`);
    expect(human.stdout.trimStart().startsWith("{")).toBe(false);
  });

  test("advertises output selection in help", async () => {
    const result = await runCli("--help");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("--format human|json");
  });

  test("keeps results on stdout and diagnostics on stderr", async () => {
    const result = await runCli("status", "--unknown", "--format", "json");

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: "CLI_UNKNOWN_OPTION",
      details: { command: "status", option: "--unknown" }
    });
  });
});
