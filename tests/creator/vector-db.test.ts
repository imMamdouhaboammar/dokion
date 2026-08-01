import { describe, expect, test } from "bun:test";
import { VectorDbDriver } from "../../src/creator/drivers/vector-db.js";

describe("VectorDbDriver", () => {
  test("fetches vector search entries from options or local payload", async () => {
    const driver = new VectorDbDriver();
    const memories = await driver.fetchMemories({
      customRecords: [
        {
          id: "vec-1",
          payload: {
            title: "ADR-005: Use Vector Search for Rule Retrieval",
            content: "Developers must use Qdrant or ChromaDB for semantic rule retrieval.",
            category: "architecture",
          },
        },
      ],
    });

    expect(memories.length).toBe(1);
    const memory = memories[0]!;
    expect(memory.title).toContain("ADR-005");
    expect(memory.source).toBe("vector-db");
    expect(memory.category).toBe("architecture");
  });

  test("fetches Qdrant / ChromaDB payload formatted records", async () => {
    const driver = new VectorDbDriver("qdrant");
    const memories = await driver.fetchMemories({
      qdrantPoints: [
        {
          id: "q-101",
          payload: {
            ruleName: "Atomic Commits",
            ruleDescription: "Ensure atomic commits with clean message history.",
          },
        },
      ],
    });

    expect(memories.length).toBe(1);
    const memory = memories[0]!;
    expect(memory.source).toBe("qdrant");
    expect(memory.content).toContain("Atomic Commits");
  });
});
