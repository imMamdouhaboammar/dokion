import { describe, expect, test } from "bun:test";

const workflowPath = ".github/workflows/autofix.yml";

function collectUses(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) collectUses(entry, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  const record = value as Record<string, unknown>;
  if (typeof record.uses === "string") found.push(record.uses);
  for (const child of Object.values(record)) collectUses(child, found);
  return found;
}

describe("autofix workflow contract", () => {
  test("runs only deterministic repository fixes with pinned read-only actions", async () => {
    const text = await Bun.file(workflowPath).text();
    const workflow = Bun.YAML.parse(text) as {
      name?: string;
      on?: Record<string, unknown>;
      permissions?: Record<string, string>;
      jobs?: Record<string, { steps?: Array<Record<string, unknown>> }>;
    };

    expect(workflow.name).toBe("autofix.ci");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.on).toHaveProperty("pull_request");
    expect(workflow.on?.push).toEqual({ branches: ["main"] });

    const uses = collectUses(workflow);
    expect(uses).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
    expect(uses).toContain("oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6");
    expect(uses.filter((value) => value.startsWith("autofix-ci/action@"))).toEqual([
      "autofix-ci/action@c5b2d67aa2274e7b5a18224e8171550871fc7e4a"
    ]);
    for (const action of uses) {
      expect(action).toMatch(/@[a-f0-9]{40}$/);
    }

    expect(text).toContain("bun install --frozen-lockfile");
    expect(text).toContain("bun run generate:product-surface");
    expect(text).not.toMatch(/prettier|biome|eslint|npm ci|npx /i);
    expect(text).not.toMatch(/contents:\s*write|pull-requests:\s*write/i);
  });
});
