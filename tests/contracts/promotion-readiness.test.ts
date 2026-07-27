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
  test("publishes detailed workstreams with unique executable task cards", async () => {
    const files = [
      "core-autopilot.md",
      "playbook-library.md",
      "capability-modules.md",
      "state-execution-security.md",
      "evidence-audit-readiness.md",
      "product-distribution.md"
    ];
    const contents = await Promise.all(files.map((file) => read(`docs/backlog/${file}`)));
    const taskIds = contents.flatMap((content) =>
      [...content.matchAll(/^### ([A-Z]+-\d{3}) /gm)].map((match) => match[1]!)
    );

    expect(taskIds.length).toBe(88);
    expect(new Set(taskIds).size).toBe(taskIds.length);

    const taskIdSet = new Set(taskIds);
    const dependencies = new Map<string, string[]>();
    for (const content of contents) {
      const sections = [...content.matchAll(/^### ([A-Z]+-\d{3}) .+$(.*?)(?=^### [A-Z]+-\d{3} |\z)/gms)];
      for (const section of sections) {
        const id = section[1]!;
        const dependencyLine = section[2]!.match(/^- Depends on: (.+)$/m)?.[1]?.trim() ?? "None";
        dependencies.set(id, dependencyLine === "None" ? [] : dependencyLine.split(",").map((value) => value.trim()));
      }
    }
    for (const [id, declared] of dependencies) {
      for (const dependency of declared) {
        expect(taskIdSet.has(dependency), `${id} depends on missing ${dependency}`).toBe(true);
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      expect(visiting.has(id), `dependency cycle at ${id}`).toBe(false);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of dependencies.get(id) ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of taskIds) visit(id);

    for (const content of contents) {
      expect(content).toContain("- Priority: P0");
      expect(content).toContain("- Depends on:");
      expect(content).toContain("- Primary files:");
      expect(content).toContain("- Verification:");
      expect(content).toContain("- Deliverable:");
      expect(content).toContain("- Acceptance:");
      expect(content).not.toMatch(/\b(TBD|TODO|implement later)\b/i);
    }
  });

});
