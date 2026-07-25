import { describe, expect, test } from "bun:test";

import {
  assertReleaseVersion,
  detectSensitiveText,
  validatePackedFiles,
  validateStaticDistribution
} from "../src/distribution/distribution-validator.ts";

const root = process.cwd();

describe("M6 static distribution contract", () => {
  test("package metadata and adapters are release-ready", async () => {
    const report = await validateStaticDistribution(root);
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.packageVersion).toBe("0.3.0");
    expect(report.geminiVersion).toBe(report.packageVersion);
    expect(report.canonicalSkill).toBe("skills/dokion-hardening/SKILL.md");
  });

  test("release tags must exactly match package and Gemini versions", () => {
    expect(() => assertReleaseVersion("v0.3.0", "0.3.0", "0.3.0")).not.toThrow();
    expect(() => assertReleaseVersion("0.3.0", "0.3.0", "0.3.0")).toThrow("must start with v");
    expect(() => assertReleaseVersion("v0.3.1", "0.3.0", "0.3.0")).toThrow("does not match package version");
    expect(() => assertReleaseVersion("v0.3.0", "0.3.0", "0.3.1")).toThrow("Gemini extension version");
  });
});

describe("M6 packed-file policy", () => {
  test("accepts the required runtime and adapter surface", () => {
    const errors = validatePackedFiles([
      "package.json",
      "README.md",
      "LICENSE",
      "src/cli.ts",
      "src/platform/platform-detector.ts",
      "schemas/dokion-playbook.schema.json",
      "skills/dokion-hardening/SKILL.md",
      ".claude-plugin/plugin.json",
      "hooks/hooks.json",
      "scripts/claude-playbook-guard.ts",
      "AGENTS.md",
      ".agents/skills/dokion-hardening/SKILL.md",
      "GEMINI.md",
      "gemini-extension.json",
      "commands/dokion/run.toml",
      "commands/dokion/status.toml",
      "dokion.json"
    ]);
    expect(errors).toEqual([]);
  });

  test("rejects tests, state, plans, credentials, lockfiles, and generated output", () => {
    const errors = validatePackedFiles([
      "package.json",
      "README.md",
      "LICENSE",
      "src/cli.ts",
      "schemas/dokion-playbook.schema.json",
      "skills/dokion-hardening/SKILL.md",
      ".claude-plugin/plugin.json",
      "hooks/hooks.json",
      "scripts/claude-playbook-guard.ts",
      "AGENTS.md",
      ".agents/skills/dokion-hardening/SKILL.md",
      "GEMINI.md",
      "gemini-extension.json",
      "commands/dokion/run.toml",
      "commands/dokion/status.toml",
      "dokion.json",
      "tests/runtime-core.test.ts",
      ".dokion/state.json",
      "docs/superpowers/plans/internal.md",
      ".env",
      ".npmrc",
      "bun.lock",
      "dist/dokion",
      "diagnostics/test.log"
    ]);
    expect(errors).toContain("forbidden packed path: tests/runtime-core.test.ts");
    expect(errors).toContain("forbidden packed path: .dokion/state.json");
    expect(errors).toContain("forbidden packed path: .env");
    expect(errors).toContain("forbidden packed path: dist/dokion");
  });

  test("detects common secrets and private local paths in packed text", () => {
    expect(detectSensitiveText("config.txt", "OPENAI_API_KEY=sk-proj-1234567890abcdef").some((item) => item.startsWith("secret signature"))).toBe(true);
    expect(detectSensitiveText("notes.txt", "/Users/mamdouh/private/project").some((item) => item.startsWith("private local path"))).toBe(true);
    expect(detectSensitiveText("README.md", "Install with bun add dokion")).toEqual([]);
  });
});
