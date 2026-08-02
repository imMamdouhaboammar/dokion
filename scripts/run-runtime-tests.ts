const runtimeTestGlobs = [
  new Bun.Glob("**/*.test.ts"),
  new Bun.Glob("**/*.test.js")
];

const discovered = new Set<string>();
for (const glob of runtimeTestGlobs) {
  for await (const path of glob.scan({ cwd: "tests", onlyFiles: true })) {
    discovered.add(`tests/${path}`);
  }
}

const testFiles = [...discovered].sort();
if (testFiles.length === 0) {
  console.error("No runtime tests were found under tests/");
  process.exit(1);
}

const child = Bun.spawn([process.execPath, "test", ...testFiles], {
  cwd: process.cwd(),
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit"
});

process.exit(await child.exited);
