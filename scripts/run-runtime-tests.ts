import { resolve } from "node:path";

const runtimeTestGlobs = [
  new Bun.Glob("**/*.test.ts"),
  new Bun.Glob("**/*.test.js")
];

export async function discoverRuntimeTests(root = process.cwd()): Promise<string[]> {
  const testsRoot = resolve(root, "tests");
  const discovered = new Set<string>();

  for (const glob of runtimeTestGlobs) {
    for await (const path of glob.scan({ cwd: testsRoot, onlyFiles: true })) {
      discovered.add(resolve(testsRoot, path));
    }
  }

  return [...discovered].sort();
}

async function runRuntimeTests(): Promise<number> {
  const testFiles = await discoverRuntimeTests();
  if (testFiles.length === 0) {
    console.error("No runtime tests were found under tests/");
    return 1;
  }

  const child = Bun.spawn([process.execPath, "test", ...testFiles], {
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit"
  });

  return await child.exited;
}

if (import.meta.main) {
  process.exit(await runRuntimeTests());
}
