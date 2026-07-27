import { describe, expect, test } from "bun:test";

const root = process.cwd();
const workstreamFiles = [
  "core-autopilot.md",
  "playbook-library.md",
  "capability-modules.md",
  "state-execution-security.md",
  "evidence-audit-readiness.md",
  "product-distribution.md"
] as const;

async function read(path: string): Promise<string> {
  return Bun.file(`${root}/${path}`).text();
}

interface TaskCard {
  id: string;
  body: string;
  dependencies: string[];
}

function parseTaskCards(content: string): TaskCard[] {
  return content
    .split(/^### /m)
    .slice(1)
    .flatMap((section) => {
      const [heading = "", ...bodyLines] = section.split("\n");
      const id = heading.match(/^([A-Z]+-\d{3}) /)?.[1];
      if (!id) return [];
      const body = bodyLines.join("\n");
      const dependencyLine = body.match(/^- Depends on: (.+)$/m)?.[1]?.trim() ?? "None";
      return [{
        id,
        body,
        dependencies: dependencyLine === "None"
          ? []
          : dependencyLine.split(",").map((value) => value.trim())
      }];
    });
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

  test("publishes 88 complete task cards with a valid acyclic dependency graph", async () => {
    const contents = await Promise.all(workstreamFiles.map((file) => read(`docs/backlog/${file}`)));
    const cards = contents.flatMap(parseTaskCards);
    const taskIds = cards.map((card) => card.id);
    const taskIdSet = new Set(taskIds);

    expect(cards).toHaveLength(88);
    expect(taskIdSet.size).toBe(cards.length);

    for (const card of cards) {
      expect(card.body).toContain("- Priority: P");
      expect(card.body).toContain("- Depends on:");
      expect(card.body).toContain("- Primary files:");
      expect(card.body).toContain("- Verification:");
      expect(card.body).toContain("- Deliverable:");
      expect(card.body).toContain("- Acceptance:");
      expect(card.body).not.toMatch(/\b(TBD|TODO|implement later)\b/i);
      for (const dependency of card.dependencies) {
        expect(taskIdSet.has(dependency), `${card.id} depends on missing ${dependency}`).toBe(true);
      }
    }

    const dependencyMap = new Map(cards.map((card) => [card.id, card.dependencies]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
      expect(visiting.has(id), `dependency cycle at ${id}`).toBe(false);
      if (visited.has(id)) return;
      visiting.add(id);
      for (const dependency of dependencyMap.get(id) ?? []) visit(dependency);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of taskIds) visit(id);
  });

  test("keeps tasks.md synchronized with every workstream and promotion gate", async () => {
    const [tasks, ...contents] = await Promise.all([
      read("tasks.md"),
      ...workstreamFiles.map((file) => read(`docs/backlog/${file}`))
    ]);
    const documentedIds = contents.flatMap(parseTaskCards).map((card) => card.id).sort();
    const trackedIds = [...tasks.matchAll(/^- \[[ x~]\] \*\*([A-Z]+-\d{3})\*\*/gm)]
      .map((match) => match[1]!)
      .filter((id) => !id.startsWith("PG-"))
      .sort();
    const promotionGates = [...tasks.matchAll(/^- \[[ x~]\] \*\*(PG-\d{3})\*\*/gm)].map((match) => match[1]);

    expect(trackedIds).toEqual(documentedIds);
    expect(new Set(trackedIds).size).toBe(88);
    expect(promotionGates).toEqual(Array.from({ length: 12 }, (_, index) => `PG-${String(index + 1).padStart(3, "0")}`));
    for (const file of workstreamFiles) expect(tasks).toContain(`docs/backlog/${file}`);
    expect(tasks).toContain("Curated built-in playbooks");
    expect(tasks).toContain("Custom playbooks");
  });

  test("publishes the execution plan and links the operational roadmap", async () => {
    const [index, plan] = await Promise.all([
      read("docs/backlog/README.md"),
      read("docs/superpowers/plans/2026-07-27-promotion-ready-delivery-plan.md")
    ]);

    expect(index).toContain("tasks.md");
    expect(index).toContain("promotion-readiness.md");
    for (const file of workstreamFiles) expect(index).toContain(file);
    expect(plan).toContain("**Goal:**");
    expect(plan).toContain("**Architecture:**");
    expect(plan).toContain("**Tech Stack:**");
    expect(plan).toContain("## Global Constraints");
    expect(plan).toContain("## Standard Verification");
    expect(plan).toContain("## Wave 5: Product, Adapters, Distribution, and Promotion");
  });
});
