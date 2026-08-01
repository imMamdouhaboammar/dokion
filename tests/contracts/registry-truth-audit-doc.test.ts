import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("Registry truth audit documentation", () => {
  test("marks the obsolete Community Hub design as superseded", async () => {
    const spec = await read("docs/superpowers/specs/2026-08-01-community-playbook-hub-design.md");

    expect(spec).toContain("Status: Superseded");
    expect(spec).toContain("Issue #47");
    expect(spec).toContain("ADR-0003");
    expect(spec).toContain("ADR-0004");
    expect(spec).toContain("ADR-0005");
    expect(spec).not.toContain("Approved for Implementation");
    expect(spec).not.toContain("Dynamic Composite Score");
  });

  test("maps every quarantined claim to a later implementation workstream", async () => {
    const audit = await read("docs/architecture/registry-truth-audit.md");

    for (const marker of [
      "Hardcoded package catalog",
      "Synthetic pull",
      "Local-only publish",
      "No-op sync",
      "Unsupported marketplace metrics",
      "Browser-rendered untrusted metadata",
      "PR 2",
      "PR 11",
      "REGISTRY_SOURCE_REQUIRED",
      "REGISTRY_NOT_IMPLEMENTED"
    ]) {
      expect(audit).toContain(marker);
    }
    expect(audit).toContain("No quarantined behavior is considered complete");
  });
});
