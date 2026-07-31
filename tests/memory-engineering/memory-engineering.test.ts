import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditMemoryRepository,
  evaluateMemoryBudget,
  initMemoryRepository,
  listMemoryPatterns,
  packMemoryContext,
} from "../../src/memory-engineering";
import { handleMemoryCommand } from "../../src/cli/handlers/memory.ts";


describe("Memory Engineering Integration Suite", () => {
  test("auditMemoryRepository detects uninitialized memory repository as M0", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "dokion-mem-test-"));
    try {
      const result = await auditMemoryRepository(tempDir);
      expect(result.level).toBe("M0");
      expect(result.score).toBeLessThan(40);
      expect(result.findings.some((f) => f.level === "fail")).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("initMemoryRepository scaffolds memory posture and climbs score to M1/M2", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "dokion-mem-init-"));
    try {
      const initResult = await initMemoryRepository(tempDir, {
        pattern: "session-scratchpad",
        tool: "grok",
      });

      expect(initResult.pattern).toBe("session-scratchpad");
      expect(initResult.written.length).toBeGreaterThan(0);

      const auditResult = await auditMemoryRepository(tempDir);
      expect(auditResult.score).toBeGreaterThanOrEqual(40);
      expect(["M1", "M2", "M3"]).toContain(auditResult.level);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("evaluateMemoryBudget detects budget overflow warnings", () => {
    const stats = {
      scratchCount: 30, // exceeds max 20
      episodicCount: 10,
      durableCount: 150, // exceeds max 100
      estimatedTokens: 2500, // exceeds max 2000
    };

    const evaluated = evaluateMemoryBudget(stats);
    expect(evaluated.budgetExceeded).toBe(true);
    expect(evaluated.warnings.length).toBe(3);
  });

  test("packMemoryContext structures prompt context cleanly across tiers", () => {
    const items = [
      {
        id: "1",
        tier: "durable" as const,
        content: "System uses Bun runtime 1.3.14.",
        confidenceTag: "observed" as const,
        timestamp: "2026-07-31",
      },
      {
        id: "2",
        tier: "episodic" as const,
        content: "Integrated memory engineering into Dokion CLI.",
        confidenceTag: "decided" as const,
        timestamp: "2026-07-31",
      },
      {
        id: "3",
        tier: "scratch" as const,
        content: "Testing context packing logic.",
        confidenceTag: "hypothesis" as const,
        timestamp: "2026-07-31",
      },
    ];

    const packed = packMemoryContext(items, 2000);
    expect(packed.durableItems.length).toBe(1);
    expect(packed.episodicItems.length).toBe(1);
    expect(packed.scratchItems.length).toBe(1);
    expect(packed.formattedPromptContext).toContain("Durable Facts");
    expect(packed.formattedPromptContext).toContain("[observed] System uses Bun runtime 1.3.14.");
    expect(packed.totalTokens).toBeGreaterThan(0);
  });

  test("listMemoryPatterns returns supported pattern definitions", () => {
    const patterns = listMemoryPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(5);
    const ids = patterns.map((p) => p.id);
    expect(ids).toContain("session-scratchpad");
    expect(ids).toContain("durable-facts-store");
  });

  test("handleMemoryCommand handles subcommands cleanly", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "dokion-mem-cmd-"));
    try {
      const initCode = await handleMemoryCommand({ subcommand: "init", targetDir: tempDir, pattern: "session-scratchpad" });
      expect(initCode).toBe(0);

      const statusCode = await handleMemoryCommand({ subcommand: "status", targetDir: tempDir });
      expect(statusCode).toBe(0);

      const patternsCode = await handleMemoryCommand({ subcommand: "patterns" });
      expect(patternsCode).toBe(0);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
