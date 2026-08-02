import { describe, expect, test } from "bun:test";

interface PackageManifest {
  scripts?: Record<string, string>;
}

describe("repository test boundaries", () => {
  test("keeps runtime and frontend verification in explicit package scopes", async () => {
    const rootPackage = await Bun.file("package.json").json() as PackageManifest;
    const frontendPackage = await Bun.file("frontend/package.json").json() as PackageManifest;
    const workflow = await Bun.file(".github/workflows/ci.yml").text();
    const recoveryWorkflow = await Bun.file(".github/workflows/recovery-ci.yml").text();
    const releaseWorkflow = await Bun.file(".github/workflows/release.yml").text();
    const currentGuides = await Promise.all([
      "AGENTS.md",
      "README.md",
      "CONTRIBUTING.md",
      "docs/engineering/commit-policy.md",
      "docs/RELEASING.md"
    ].map((path) => Bun.file(path).text()));

    expect(rootPackage.scripts?.test).toBe("bun run scripts/run-runtime-tests.ts");
    expect(rootPackage.scripts?.prepack).toContain("bun run test");
    const runtimeRunner = await Bun.file("scripts/run-runtime-tests.ts").text();
    expect(runtimeRunner).toContain('new Bun.Glob("**/*.test.ts")');
    expect(runtimeRunner).toContain('new Bun.Glob("**/*.test.js")');
    expect(runtimeRunner).toContain('const testsRoot = resolve(root, "tests")');
    expect(runtimeRunner).toContain('resolve(testsRoot, path)');
    expect(runtimeRunner).toContain('Bun.spawn([process.execPath, "test", ...testFiles]');
    expect(frontendPackage.scripts?.test).toBe("bun test src/tests");
    expect(frontendPackage.scripts?.lint).toBe("tsc --noEmit");

    expect(workflow).toContain("bun run test 2>&1 | tee test.log");
    expect(workflow).toContain("working-directory: frontend");
    expect(workflow).toContain("run: bun install --frozen-lockfile");
    expect(workflow).toContain("run: bun run test");
    expect(workflow).toContain("run: bun run lint");
    expect(workflow).toContain("run: bun run build");
    expect(recoveryWorkflow).toContain("run: bun run test");
    expect(recoveryWorkflow).not.toContain("run: bun test");
    expect(releaseWorkflow).toContain("bun run test");
    expect(releaseWorkflow).not.toContain("\n          bun test\n");
    for (const guide of currentGuides) {
      expect(guide).toContain("bun run test");
    }
  });
});
