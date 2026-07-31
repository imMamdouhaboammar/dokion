import { expect, test, describe } from "bun:test";
import { PlaybookCreatorEngine } from "../../src/creator/engine.js";

describe("PlaybookCreatorEngine Integration with Advanced Memory Drivers", () => {
  test("synthesizes playbook from combined ADR, Vector DB, Knowledge Graph, and PR sources", async () => {
    const engine = new PlaybookCreatorEngine();
    const result = await engine.createPlaybook({
      topic: "Enterprise Code Review & Architecture Best Practices",
      source: "adr",
      customMemories: [
        {
          id: "mem-adr-1",
          source: "adr",
          timestamp: new Date().toISOString(),
          title: "ADR-010: Strict Type Checking",
          content: "Enforce strict TypeScript compiler flags across all modules.",
          category: "architecture",
        },
        {
          id: "mem-vec-1",
          source: "vector-db",
          timestamp: new Date().toISOString(),
          title: "Vector Search: Qdrant Rule",
          content: "Use Bun test runner with atomic assertions.",
          category: "testing",
        },
        {
          id: "mem-kg-1",
          source: "knowledge-graph",
          timestamp: new Date().toISOString(),
          title: "Knowledge Graph Triple",
          content: "ServiceA mandates StrictAuthCheck",
          category: "security",
        },
        {
          id: "mem-pr-1",
          source: "github-pr",
          timestamp: new Date().toISOString(),
          title: "PR #42: Authentication Refactor",
          content: "Always run security linter before committing PRs.",
          category: "general",
        },
      ],
    });

    expect(result.success).toBeTrue();
    expect(result.extractedStepsCount).toBeGreaterThan(0);
    expect(result.playbook.project.notes).toContain("Enterprise Code Review & Architecture Best Practices");
    expect(result.memoryEntriesProcessed).toBe(4);
  });
});
