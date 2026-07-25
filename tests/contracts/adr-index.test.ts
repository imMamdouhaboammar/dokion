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
  });

  test("records context decision consequences and amendment rules", async () => {
    for (const path of ["docs/adr/0001-authority-model.md", "docs/adr/0002-bun-only-runtime.md"]) {
      const adr = await read(path);
      for (const heading of ["## Context", "## Decision", "## Consequences", "## Amendment rules"]) {
        expect(adr).toContain(heading);
      }
      expect(adr).toContain("Status: Accepted");
      expect(adr).toContain("superseding ADR");
    }
  });
});
