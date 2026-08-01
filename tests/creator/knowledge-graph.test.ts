import { describe, expect, test } from "bun:test";
import { KnowledgeGraphDriver } from "../../src/creator/drivers/knowledge-graph.js";

describe("KnowledgeGraphDriver", () => {
  test("parses knowledge graph triples into memory entries", async () => {
    const driver = new KnowledgeGraphDriver();
    const memories = await driver.fetchMemories({
      triples: [
        { subject: "ServiceA", predicate: "mandates", object: "StrictAuthCheck" },
        { subject: "DatabaseB", predicate: "requires", object: "SSLConnection" },
      ],
    });

    expect(memories.length).toBe(2);
    const firstMemory = memories[0]!;
    expect(firstMemory.source).toBe("knowledge-graph");
    expect(firstMemory.content).toContain("ServiceA mandates StrictAuthCheck");
    expect(firstMemory.category).toBe("architecture");
  });

  test("parses graph nodes with relationships", async () => {
    const driver = new KnowledgeGraphDriver();
    const memories = await driver.fetchMemories({
      graphNodes: [
        {
          id: "node-10",
          label: "ADR-008: Event-Driven Pipeline",
          relations: ["uses Kafka for messaging", "requires schema registry validation"],
        },
      ],
    });

    expect(memories.length).toBe(1);
    const memory = memories[0]!;
    expect(memory.title).toBe("ADR-008: Event-Driven Pipeline");
    expect(memory.content).toContain("requires schema registry validation");
  });
});
