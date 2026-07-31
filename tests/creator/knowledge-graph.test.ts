import { expect, test, describe } from "bun:test";
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
    expect(memories[0].source).toBe("knowledge-graph");
    expect(memories[0].content).toContain("ServiceA mandates StrictAuthCheck");
    expect(memories[0].category).toBe("architecture");
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
    expect(memories[0].title).toBe("ADR-008: Event-Driven Pipeline");
    expect(memories[0].content).toContain("requires schema registry validation");
  });
});
