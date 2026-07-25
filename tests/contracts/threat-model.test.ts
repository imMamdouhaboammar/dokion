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
    expect(security).toContain("docs/security/threat-model.md");
  });

  test("covers the required attack classes", async () => {
    const model = await read("docs/security/threat-model.md");

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
      expect(model.toLowerCase()).toContain(threat);
    }
  });

  test("identifies assets inputs boundaries and invariants", async () => {
    const model = await read("docs/security/threat-model.md");

    for (const marker of [
      "Protected assets",
      "Attacker-controlled inputs",
      "Operator-controlled inputs",
      "Developer-controlled inputs",
      "Trust boundaries",
      "Security invariants",
      "Out-of-scope attacker stories"
    ]) {
      expect(model).toContain(marker);
    }
  });
});
