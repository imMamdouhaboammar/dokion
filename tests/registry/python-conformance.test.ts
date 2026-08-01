import { describe, expect, test } from "bun:test";

const root = process.cwd();

describe("Registry protocol Python conformance", () => {
  test("validates schemas and refuses every negative fixture without network access", async () => {
    const child = Bun.spawn(["python3", "schemas/registry/conformance_test.py"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      env: {
        ...process.env,
        NO_PROXY: "*",
        no_proxy: "*"
      }
    });

    const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
    const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
    const exitCode = await child.exited;
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

    expect(exitCode, stderr).toBe(0);
    expect(stdout).toContain("Registry protocol conformance passed");
    expect(stderr).toBe("");
  });
});
