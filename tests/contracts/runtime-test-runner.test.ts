import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { discoverRuntimeTests } from "../../scripts/run-runtime-tests.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runtime test runner", () => {
  test("passes absolute runtime paths so nested package matches cannot be collected", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-runtime-test-boundary-"));
    roots.push(root);
    await mkdir(join(root, "tests"), { recursive: true });
    await mkdir(join(root, "frontend/tests"), { recursive: true });

    await writeFile(
      join(root, "tests/shared.test.ts"),
      'import { test, expect } from "bun:test"; test("runtime", () => expect(true).toBe(true));\n'
    );
    await writeFile(
      join(root, "frontend/tests/shared.test.ts"),
      'import { test } from "bun:test"; test("frontend", () => { throw new Error("must not run"); });\n'
    );

    const testFiles = await discoverRuntimeTests(root);
    expect(testFiles).toEqual([resolve(root, "tests/shared.test.ts")]);
    expect(testFiles.every((path) => isAbsolute(path))).toBe(true);

    const child = Bun.spawn([process.execPath, "test", ...testFiles], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe"
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : "",
      child.exited
    ]);

    const combinedOutput = `${stdout}\n${stderr}`;
    expect(exitCode, combinedOutput).toBe(0);
    expect(combinedOutput).toContain("1 pass");
    expect(combinedOutput).not.toContain("must not run");
  });
});
