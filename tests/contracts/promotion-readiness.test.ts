import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  return Bun.file(`${root}/${path}`).text();
}

describe("promotion readiness documentation contract", () => {
  test("defines a qualified public beta gate without weakening production readiness", async () => {
    const content = await read("docs/backlog/promotion-readiness.md");

    expect(content).toContain("Promotion readiness is not production readiness");
    expect(content).toContain("Public beta");
    expect(content).toContain("Production grade");
    expect(content).toContain("docs/architecture/production-readiness.md");
  });

  test("treats built-in and custom playbooks as first-class product paths", async () => {
    const [index, gate] = await Promise.all([
      read("docs/backlog/README.md"),
      read("docs/backlog/promotion-readiness.md")
    ]);

    expect(index).toContain("Curated built-in playbooks");
    expect(index).toContain("Custom playbooks");
    expect(gate).toContain("PG-003 Curated built-in playbook library");
    expect(gate).toContain("PG-004 Safe custom playbooks");
    expect(gate).toContain(".dokion/playbook.json");
  });

  test("defines twelve blocking gates and forbids unqualified marketing claims", async () => {
    const content = await read("docs/backlog/promotion-readiness.md");
    const gates = [...content.matchAll(/^### (PG-\d{3}) /gm)].map((match) => match[1]);

    expect(gates).toEqual(Array.from({ length: 12 }, (_, index) => `PG-${String(index + 1).padStart(3, "0")}`));
    expect(content).toContain("Fully autonomous security engineer");
    expect(content).toContain("No promotion-ready checkbox may be marked complete");
  });
});
