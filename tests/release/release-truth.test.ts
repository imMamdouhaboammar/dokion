import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CANONICAL_PACKAGE_DESCRIPTION,
  evaluateReleaseTruth,
  loadReleaseTruthSources,
  writeReleaseTruthReport,
  type ReleaseTruthSources
} from "../../scripts/validate-release-truth.ts";
import { resolveCliCommand } from "../../src/cli/command-registry.ts";

const repositoryRoot = process.cwd();

function cloneSources(sources: ReleaseTruthSources): ReleaseTruthSources {
  return {
    ...sources,
    packageManifest: structuredClone(sources.packageManifest),
    publicDocuments: { ...sources.publicDocuments }
  };
}

function issueCodes(sources: ReleaseTruthSources): string[] {
  return evaluateReleaseTruth(sources).issues.map((issue) => issue.code);
}

describe("release truth gate", () => {
  test("accepts the exact current repository truth surface", async () => {
    const sources = await loadReleaseTruthSources(repositoryRoot);
    const report = evaluateReleaseTruth(sources);

    expect(report.valid, JSON.stringify(report.issues, null, 2)).toBe(true);
    expect(report.package.description).toBe(CANONICAL_PACKAGE_DESCRIPTION);
    expect(report.commitSha).toMatch(/^[a-f0-9]{40}$/);
  });
  test("rejects command status drift in the committed product surface", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    const surface = JSON.parse(sources.committedProductSurface) as {
      commands: Array<{ id: string; status: string }>;
    };
    const verify = surface.commands.find((command) => command.id === "verify");
    if (!verify) throw new Error("verify command fixture is missing");
    verify.status = "PLANNED";
    sources.committedProductSurface = `${JSON.stringify(surface, null, 2)}\n`;

    expect(issueCodes(sources)).toContain("COMMAND_SURFACE_DRIFT");
  });

  test("rejects executable CLI help drift", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    const trace = resolveCliCommand("trace");
    if (!trace) throw new Error("trace command fixture is missing");
    sources.cliHelp += `\n${trace.helpLine}\n`;

    expect(issueCodes(sources)).toContain("CLI_HELP_SNAPSHOT_DRIFT");
    expect(issueCodes(sources)).toContain("CLI_HELP_COMMAND_DRIFT");
  });

  test("rejects a structurally invalid product surface", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.committedProductSurface = "{}\n";

    expect(issueCodes(sources)).toContain("PRODUCT_SURFACE_INVALID_SHAPE");
  });

  test("rejects package description drift", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.packageManifest.description = "Generic AI automation toolkit";

    expect(issueCodes(sources)).toContain("PACKAGE_DESCRIPTION_DRIFT");
  });

  test("rejects README examples for planned commands", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.readme += "\n```bash\ndokion trace --format html\n```\n";

    expect(issueCodes(sources)).toContain("README_COMMAND_UNAVAILABLE");
  });
  test("rejects badges for unsupported integrations", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.readme += "\n![Cursor](https://img.shields.io/badge/Cursor-supported-blue)\n";

    expect(issueCodes(sources)).toContain("UNSUPPORTED_INTEGRATION_BADGE");
  });

  test("binds the report to git HEAD instead of a spoofed environment SHA", async () => {
    const original = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = "f".repeat(40);
    try {
      const sources = await loadReleaseTruthSources(repositoryRoot);
      expect(sources.commitSha).not.toBe(process.env.GITHUB_SHA);
      expect(sources.commitSha).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      if (original === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = original;
    }
  });

  test("rejects a report that cannot identify the exact commit", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.commitSha = null;

    expect(issueCodes(sources)).toContain("RELEASE_COMMIT_UNAVAILABLE");
  });

  test("rejects a stale README release line", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    sources.readme = sources.readme
      .replace("release-0.3.x", "release-0.2.x")
      .replace("Current release line: `0.3.x`", "Current release line: `0.2.x`");

    expect(issueCodes(sources)).toContain("RELEASE_LINE_DRIFT");
  });

  test("rejects missing claim evidence", async () => {
    const sources = cloneSources(await loadReleaseTruthSources(repositoryRoot));
    const path = "docs/getting-started/ONBOARDING.md";
    sources.publicDocuments[path] = sources.publicDocuments[path]!.replace(
      "`dokion verify` runs only supported verification commands and release gates explicitly declared by the active Playbook",
      "Verification is available"
    );

    expect(issueCodes(sources)).toContain("PUBLIC_CLAIM_EVIDENCE_MISSING");
  });

  test("refuses to write a report outside the repository root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-release-truth-output-"));
    try {
      const report = evaluateReleaseTruth(await loadReleaseTruthSources(repositoryRoot));
      await expect(
        writeReleaseTruthReport(root, "../outside-release-truth.json", report)
      ).rejects.toThrow("inside the repository root");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("wires release truth before package smoke and requires exact sign-off", async () => {
    const packageManifest = await Bun.file("package.json").json() as {
      files?: string[];
      scripts?: Record<string, string>;
    };
    const ci = await Bun.file(".github/workflows/ci.yml").text();
    const release = await Bun.file(".github/workflows/release.yml").text();
    const checklist = await Bun.file("docs/launch/public-beta-checklist.md").text();

    for (const path of [
      "scripts/validate-release-truth.ts",
      "generated/product-surface.json",
      "docs/getting-started/ONBOARDING.md",
      "docs/launch/MARKETING_STRATEGY.md",
      "docs/launch/public-beta-checklist.md"
    ]) {
      expect(packageManifest.files).toContain(path);
    }
    expect(packageManifest.scripts?.["validate:release-truth"]).toBe(
      "bun run scripts/validate-release-truth.ts"
    );
    expect(packageManifest.scripts?.prepack).toContain("validate:release-truth");
    expect(() => Bun.YAML.parse(ci)).not.toThrow();
    expect(() => Bun.YAML.parse(release)).not.toThrow();
    expect(ci).toContain("contents: read");
    expect(ci).not.toContain("Apply bounded Registry path hardening");
    const ciTruth = ci.indexOf("Validate release truth");
    const ciSmoke = ci.indexOf("Smoke-test clean Bun installation");
    expect(ciTruth).toBeGreaterThanOrEqual(0);
    expect(ciSmoke).toBeGreaterThan(ciTruth);
    expect(ci).toContain("release-truth-report.json");
    const releaseTruth = release.indexOf("validate:release-truth");
    const releaseSmoke = release.indexOf("smoke:package");
    expect(releaseTruth).toBeGreaterThanOrEqual(0);
    expect(releaseSmoke).toBeGreaterThan(releaseTruth);
    expect(release).toContain("cp release-truth-report.json release/release-truth-report.json");
    expect(release).toContain("sha256sum dokion-* release-truth-report.json > SHA256SUMS");
    expect(checklist).toContain("signed review of `release-truth-report.json`");
    expect(checklist).toContain("exact 40-character release-candidate commit SHA");
  });
});
