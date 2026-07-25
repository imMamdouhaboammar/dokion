import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

async function text(path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

describe("M6 Bun-only release completion", () => {
  test("ships every supported Bun cross-compile target", async () => {
    const build = await text("scripts/build-release.ts");
    for (const target of [
      "bun-linux-x64-baseline",
      "bun-linux-arm64",
      "bun-darwin-arm64",
      "bun-darwin-x64",
      "bun-windows-x64-baseline"
    ]) {
      expect(build).toContain(target);
    }
    expect(build).toContain("Bun.build");
    expect(build).not.toMatch(/\bnpm\b|\byarn\b/);
  });

  test("uses a protected Bun-only tag release workflow", async () => {
    const workflow = await text(".github/workflows/release.yml");
    expect(workflow).toContain('tags:\n      - "v*"');
    expect(workflow).toContain("environment: npm-release");
    expect(workflow).toContain("bun publish");
    expect(workflow).toContain("NPM_CONFIG_TOKEN");
    expect(workflow).toContain("bun pm pack");
    expect(workflow).toContain("bunx @google/gemini-cli@0.51.0 extensions validate .");
    expect(workflow).toContain("bun run scripts/check-release-version.ts");
    expect(workflow).toContain("bun run scripts/build-release.ts");
    expect(workflow).not.toMatch(/\bnpm\s+(?:install|pack|publish|view|run)\b/i);
    expect(workflow).not.toMatch(/\byarn\b/i);
    expect(workflow).not.toContain("id-token: write");
    expect(workflow).not.toContain(".npmrc");
    expect(workflow).not.toContain("bunfig.toml");
  });

  test("documents token scope and the OIDC limitation without storing credentials", async () => {
    const guide = await text("docs/RELEASING.md");
    expect(guide).toContain("npm-release");
    expect(guide).toContain("NPM_TOKEN");
    expect(guide).toContain("publish-only");
    expect(guide).toContain("npm CLI");
    expect(guide).toContain("Bun-only");
    expect(guide).not.toMatch(/NPM_TOKEN\s*=\s*[^<\s]/);
    expect(guide).not.toMatch(/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/);
  });
});
