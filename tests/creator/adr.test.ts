import { describe, expect, test } from "bun:test";
import { AdrDriver } from "../../src/creator/drivers/adr.js";

describe("AdrDriver", () => {
  test("parses markdown ADR content into memory entries", async () => {
    const driver = new AdrDriver();
    const memories = await driver.fetchMemories({
      customAdrs: [
        {
          id: "adr-001",
          filePath: "docs/adr/001-atomic-commits.md",
          content: "# ADR-001: Atomic Commit Policy\n\n## Status\nAccepted\n\n## Context\nCommits must be clean.\n\n## Decision\nEvery PR must be Squashed and Atomic.\n\n## Consequences\nClean git log.",
        },
      ],
    });

    expect(memories.length).toBe(1);
    const memory = memories[0]!;
    expect(memory.source).toBe("adr");
    expect(memory.title).toBe("ADR-001: Atomic Commit Policy");
    expect(memory.content).toContain("Every PR must be Squashed and Atomic");
    expect(memory.category).toBe("architecture");
  });

  test("scans directory for markdown ADR files", async () => {
    const driver = new AdrDriver();
    const memories = await driver.fetchMemories({
      adrDir: "docs/superpowers/specs",
    });

    expect(Array.isArray(memories)).toBeTrue();
  });
});
