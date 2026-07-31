import { AgentKernelDriver } from "./agent-kernel.js";
import { TranscriptLogDriver } from "./transcript.js";
import { Mem0Driver } from "./mem0.js";
import { WorkflowOptimizerDriver } from "./workflow-optimizer.js";
import { VectorDbDriver } from "./vector-db.js";
import { KnowledgeGraphDriver } from "./knowledge-graph.js";
import { AdrDriver } from "./adr.js";
import { GitHubPrDriver } from "./github-pr.js";
import type { MemoryDriver, MemoryEntry, MemorySourceType } from "../types.js";

export {
  AgentKernelDriver,
  TranscriptLogDriver,
  Mem0Driver,
  WorkflowOptimizerDriver,
  VectorDbDriver,
  KnowledgeGraphDriver,
  AdrDriver,
  GitHubPrDriver,
};

export class MemoryDriverRegistry {
  private drivers: Map<MemorySourceType, MemoryDriver> = new Map();

  constructor() {
    this.register(new AgentKernelDriver());
    this.register(new TranscriptLogDriver());
    this.register(new Mem0Driver());
    this.register(new WorkflowOptimizerDriver());
    this.register(new VectorDbDriver("vector-db"));
    this.register(new VectorDbDriver("qdrant"));
    this.register(new VectorDbDriver("chromadb"));
    this.register(new KnowledgeGraphDriver());
    this.register(new AdrDriver());
    this.register(new GitHubPrDriver("github-pr"));
    this.register(new GitHubPrDriver("github-issue"));
  }

  public register(driver: MemoryDriver): void {
    this.drivers.set(driver.name, driver);
  }

  public get(name: MemorySourceType): MemoryDriver | undefined {
    return this.drivers.get(name);
  }

  public async fetchAllMemories(options?: Record<string, unknown>): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    for (const driver of this.drivers.values()) {
      try {
        const fetched = await driver.fetchMemories(options);
        results.push(...fetched);
      } catch {
        // Continue with other drivers
      }
    }
    return results;
  }
}
