import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MemoryDriverRegistry } from "./drivers/index.js";
import { PlaybookInterpreter } from "./interpreter.js";
import { PlaybookCompiler } from "./compiler.js";
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

    // 1. Fetch memories from selected source or all sources
    if (options.customMemories && options.customMemories.length > 0) {
      memories.push(...options.customMemories);
    } else if (options.source) {
      const driver = this.registry.get(options.source);
      if (driver) {
        const fetched = await driver.fetchMemories({
          transcriptPath: options.transcriptPath,
          conversationId: options.conversationId,
        });
        memories.push(...fetched);
      }
    } else {
      // Fetch from all available drivers
      const fetched = await this.registry.fetchAllMemories({
        transcriptPath: options.transcriptPath,
        conversationId: options.conversationId,
      });
      memories.push(...fetched);
    }

    // 2. Interpret memories into action steps
    const extractedSteps = this.interpreter.parseMemories(memories, options.topic);

    // 3. Compile playbook
    const playbook = await this.compiler.compile(extractedSteps, {
      topic: options.topic,
      title: options.topic ? `${options.topic} Playbook` : undefined,
    });

    // 4. Determine output path
    const outputPath = options.outputPath || join(process.cwd(), ".dokion", "playbook.json");
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
