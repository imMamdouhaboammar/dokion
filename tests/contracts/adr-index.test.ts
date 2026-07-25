import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("architecture decision record contract", () => {
  test("publishes the ADR index and accepted decisions", async () => {
    const index = await read("docs/adr/README.md");

    expect(index).toContain("0001-authority-model.md");
    expect(index).toContain("0002-bun-only-runtime.md");
    expect(index).toContain("Accepted");
    expect(index).toContain("Numbers are never recycled");
  });

  test("records context decision consequences and amendment rules", async () => {
    for (const path of ["docs/adr/0001-authority-model.md", "docs/adr/0002-bun-only-runtime.md"]) {
      const adr = await read(path);
      for (const heading of ["## Context", "## Decision", "## Consequences", "## Alternatives considered", "## Amendment rules"]) {
        expect(adr).toContain(heading);
      }
      expect(adr).toContain("Status: Accepted");
      expect(adr).toContain("superseding ADR");
    }
  });

  test("locks the user-authority decision", async () => {
    const authority = await read("docs/adr/0001-authority-model.md");

    expect(authority).toContain(".dokion/playbook.json");
    expect(authority).toContain("sole file that authorizes Dokion execution");
    expect(authority).toContain("must never select, install, substitute, reorder, upgrade, enable");
    expect(authority).toContain("Bounded autopilot means deterministic continuation inside existing authority");
  });

  test("locks the Bun-only repository decision", async () => {
    const runtime = await read("docs/adr/0002-bun-only-runtime.md");

    for (const marker of [
      "Bun 1.3.14",
      "bun install --frozen-lockfile",
      "bun test",
      "bun pm pack",
      "bun publish",
      "npm, yarn, pnpm"
    ]) {
      expect(runtime).toContain(marker);
    }
    expect(runtime).toContain("An upstream installer exception never authorizes changing Dokion's own package manager");
  });
});
