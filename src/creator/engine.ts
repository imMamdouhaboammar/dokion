import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PlaybookCompiler } from "./compiler.js";
import { MemoryDriverRegistry } from "./drivers/index.js";
import { PlaybookInterpreter } from "./interpreter.js";
import type { CreatorEngineOptions, MemoryEntry, PlaybookCreationResult } from "./types.js";

export class PlaybookCreatorEngine {
  private registry: MemoryDriverRegistry;
  private interpreter: PlaybookInterpreter;
  private compiler: PlaybookCompiler;

  constructor() {
    this.registry = new MemoryDriverRegistry();
    this.interpreter = new PlaybookInterpreter();
    this.compiler = new PlaybookCompiler();
  }

  public async createPlaybook(options: CreatorEngineOptions): Promise<PlaybookCreationResult> {
    const memories: MemoryEntry[] = [];
    const driverOptions = {
      ...(options.transcriptPath !== undefined
        ? { transcriptPath: options.transcriptPath }
        : {}),
      ...(options.conversationId !== undefined
        ? { conversationId: options.conversationId }
        : {}),
    };

    if (options.customMemories?.length) {
      memories.push(...options.customMemories);
    } else if (options.source) {
      const driver = this.registry.get(options.source);
      if (driver) {
        memories.push(...await driver.fetchMemories(driverOptions));
      }
    } else {
      memories.push(...await this.registry.fetchAllMemories(driverOptions));
    }

    const extractedSteps = this.interpreter.parseMemories(memories, options.topic);
    const playbook = await this.compiler.compile(extractedSteps, {
      ...(options.topic !== undefined ? { topic: options.topic } : {}),
      ...(options.topic !== undefined ? { title: `${options.topic} Playbook` } : {}),
    });

    const outputPath = options.outputPath
      ?? join(process.cwd(), ".dokion", "playbook.json");
    const parentDir = dirname(outputPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    const jsonContent = JSON.stringify(playbook, null, 2);
    writeFileSync(outputPath, jsonContent, "utf-8");
    const digest = createHash("sha256").update(jsonContent).digest("hex");

    return {
      success: true,
      playbookPath: outputPath,
      playbook,
      extractedStepsCount: extractedSteps.length,
      memoryEntriesProcessed: memories.length,
      digest,
    };
  }
}
