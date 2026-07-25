import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("repository threat model contract", () => {
  test("publishes repository-scoped security guidance", async () => {
    const [model, security] = await Promise.all([
      read("docs/security/threat-model.md"),
      read("SECURITY.md")
    ]);

    expect(model).toContain("## Overview");
    expect(model).toContain("## Threat Model, Trust Boundaries, and Assumptions");
    expect(model).toContain("## Attack Surface, Mitigations, and Attacker Stories");
    expect(model).toContain("## Severity Calibration");
    expect(model).toContain("Repository: imMamdouhaboammar/dokion");
    expect(model).toContain("Version: b54f3e0f8cd45560c4933a733bb2a6369d4a0e2b");
    expect(security).toContain("docs/security/threat-model.md");
    expect(security).toContain("Report a vulnerability");
  });

  test("covers the required attack classes", async () => {
    const model = (await read("docs/security/threat-model.md")).toLowerCase();

    for (const threat of [
      "malicious playbook",
      "poisoned skill",
      "shell injection",
      "path traversal",
      "symlink",
      "state tampering",
      "secret leakage",
      "compromised release",
      "cross-agent degradation"
    ]) {
      expect(model).toContain(threat);
    }
  });

  test("identifies assets inputs boundaries assumptions and invariants", async () => {
    const model = await read("docs/security/threat-model.md");

    for (const marker of [
      "Protected assets",
      "Attacker-controlled inputs",
      "Operator-controlled inputs",
      "Developer-controlled inputs",
      "Trust boundaries",
      "Security invariants",
      "Out-of-scope attacker stories",
      "### Assumptions"
    ]) {
      expect(model).toContain(marker);
    }
  });

  test("calibrates severity with repository-specific examples", async () => {
    const model = await read("docs/security/threat-model.md");

    for (const severity of ["### Critical", "### High", "### Medium", "### Low"]) {
      expect(model).toContain(severity);
    }
    expect(model).toContain("undeclared capability or command");
    expect(model).toContain("release credentials");
    expect(model).toContain("local administrator");
  });
});
