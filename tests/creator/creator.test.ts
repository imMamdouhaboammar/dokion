import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { PlaybookCompiler } from "../../src/creator/compiler.js";
import { AgentKernelDriver } from "../../src/creator/drivers/agent-kernel.js";
import { PlaybookCreatorEngine } from "../../src/creator/engine.js";
import { PlaybookInterpreter } from "../../src/creator/interpreter.js";
import type { MemoryEntry } from "../../src/creator/types.js";

const root = process.cwd();

describe("Playbook Creator Engine Unit & Integration Tests", () => {
  test("AgentKernelDriver returns empty array if kernel path does not exist", async () => {
    const driver = new AgentKernelDriver();
    const memories = await driver.fetchMemories({ kernelPath: join(root, "non-existent-dir") });
    expect(Array.isArray(memories)).toBe(true);
    expect(memories.length).toBe(0);
  });

  test("TranscriptLogDriver parses valid transcript lines", () => {
    const mockMemories: MemoryEntry[] = [
      {
        id: "mem-1",
        source: "transcript",
        timestamp: new Date().toISOString(),
        title: "Test Step",
        content: "Run test suite with bun test and npx skills add owner/repo",
        category: "testing",
      },
    ];

    const interpreter = new PlaybookInterpreter();
    const steps = interpreter.parseMemories(mockMemories);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((step) => step.command?.includes("bun test"))).toBe(true);
  });

  test("rejects shell metacharacters extracted from untrusted memory", () => {
    const interpreter = new PlaybookInterpreter();
    const steps = interpreter.parseMemories([
      {
        id: "mem-injected",
        source: "transcript",
        timestamp: new Date().toISOString(),
        title: "Injected test command",
        content: "Run bun test; touch /tmp/dokion-injected and continue",
        category: "testing",
      },
    ]);

    expect(steps.some((step) => step.command?.includes("touch /tmp/dokion-injected"))).toBe(false);
    expect(steps.some((step) => /[;&|<>$`]/.test(step.command ?? ""))).toBe(false);
  });

  test("does not invent echo execution for conceptual memories", () => {
    const interpreter = new PlaybookInterpreter();
    const steps = interpreter.parseMemories([
      {
        id: "mem-concept",
        source: "manual",
        timestamp: new Date().toISOString(),
        title: "Review architecture carefully",
        content: "The system should preserve repository boundaries and produce evidence for every decision.",
        category: "architecture",
      },
    ]);

    expect(steps.some((step) => step.command?.startsWith("echo "))).toBe(false);
  });

  test("PlaybookCompiler compiles extracted steps into valid DokionPlaybook", async () => {
    const interpreter = new PlaybookInterpreter();
    const mockMemories: MemoryEntry[] = [
      {
        id: "m-1",
        source: "workflow-optimizer",
        timestamp: new Date().toISOString(),
        title: "Run Typecheck",
        content: "Execute bun run typecheck and bun test to verify types.",
        category: "unslop",
      },
    ];

    const steps = interpreter.parseMemories(mockMemories);
    const compiler = new PlaybookCompiler();
    const playbook = await compiler.compile(steps, { topic: "Unslop Preflight" });
    const stage = playbook.stages[0]!;
    const firstStep = stage.steps[0]!;

    expect(playbook.version).toBe("1.0.0");
    expect(playbook.project.name).toContain("unslop-preflight");
    expect(playbook.stages.length).toBe(1);
    expect(stage.steps.length).toBeGreaterThan(0);
    expect(firstStep.capability.immutable_reference).toContain("sha256:");
    expect(firstStep.approval).toBe("ALWAYS");
  });

  test("PlaybookCreatorEngine generates playbook file on disk", async () => {
    const engine = new PlaybookCreatorEngine();
    const targetPath = join(root, "tests", "fixtures", "generated-test-playbook.json");

    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
    }

    const mockMemories: MemoryEntry[] = [
      {
        id: "test-mem-1",
        source: "manual",
        timestamp: new Date().toISOString(),
        title: "UI-UX Design Engine Execution",
        content: "Run npx skills add ui-ux-design-engine and execute bun test",
        category: "ui-ux",
      },
    ];

    const result = await engine.createPlaybook({
      customMemories: mockMemories,
      topic: "UI-UX Design",
      outputPath: targetPath,
    });

    expect(result.success).toBe(true);
    expect(existsSync(targetPath)).toBe(true);

    const savedContent = JSON.parse(readFileSync(targetPath, "utf-8")) as {
      project: { name: string };
      stages: Array<{ steps: unknown[] }>;
    };
    expect(savedContent.project.name).toContain("ui-ux-design");
    expect(savedContent.stages[0]!.steps.length).toBeGreaterThan(0);

    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
    }
  });
});
