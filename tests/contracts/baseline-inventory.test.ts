import { describe, expect, test } from "bun:test";

const root = process.cwd();
const baselinePath = `${root}/docs/architecture/current-baseline.md`;

async function readBaseline(): Promise<string> {
  const file = Bun.file(baselinePath);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("audited production baseline contract", () => {
  test("records the exact audited repository baseline", async () => {
    const baseline = await readBaseline();

    expect(baseline).toContain("c254af2f5a4d07c9f1f3b84d6c0226760702bbbb");
    expect(baseline).toContain("0.3.0");
    expect(baseline).toContain("Bun 1.3.14");
    expect(baseline).toContain("M0-M6");
  });

  test("records supported agents and shipped command groups", async () => {
    const baseline = await readBaseline();

    for (const agent of ["Claude Code", "Codex", "Gemini CLI", "ordinary shell"]) {
      expect(baseline).toContain(agent);
    }

    for (const command of [
      "dokion inspect",
      "dokion doctor",
      "dokion status",
      "dokion findings",
      "dokion report",
      "dokion init",
      "dokion validate",
      "dokion run",
      "dokion resume",
      "dokion verify",
      "dokion approve",
      "dokion reject"
    ]) {
      expect(baseline).toContain(command);
    }
  });

  test("records contracts workflows and known limitations", async () => {
    const baseline = await readBaseline();

    for (const contract of [
      "dokion-manifest.schema.json",
      "dokion-playbook.schema.json",
      "dokion-state.schema.json",
      "dokion-finding.schema.json",
      "capability-lock.schema.json"
    ]) {
      expect(baseline).toContain(contract);
    }

    expect(baseline).toContain(".github/workflows/ci.yml");
    expect(baseline).toContain(".github/workflows/release.yml");
    expect(baseline).toContain("Known limitations");
    expect(baseline).toContain("Ignored untracked files");
    expect(baseline).toContain("capability lock");
    expect(baseline).toContain("POSIX shell");
  });
});
