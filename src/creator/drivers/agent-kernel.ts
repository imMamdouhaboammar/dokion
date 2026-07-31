import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export class AgentKernelDriver implements MemoryDriver {
  public name: MemoryDriver["name"] = "agent-kernel";

  public async fetchMemories(options?: { kernelPath?: string }): Promise<MemoryEntry[]> {
    const baseDir = options?.kernelPath || join(homedir(), ".agent-kernel");
    const memories: MemoryEntry[] = [];

    if (!existsSync(baseDir)) {
      return memories;
    }

    try {
      // Check AGENTS.md or memory files
      const agentsFile = join(baseDir, "dist", "AGENTS.md");
      if (existsSync(agentsFile)) {
        const content = readFileSync(agentsFile, "utf-8");
        memories.push({
          id: "agent-kernel-constitution",
          source: "agent-kernel",
          timestamp: new Date().toISOString(),
          title: "Agent Kernel Constitution & Rules",
          content,
          category: "general",
        });
      }

      // Check playbooks or memory logs in .agent-kernel/memory if present
      const memoryDir = join(baseDir, "memory");
      if (existsSync(memoryDir)) {
        const files = readdirSync(memoryDir);
        for (const file of files) {
          if (file.endsWith(".md") || file.endsWith(".json")) {
            const fullPath = join(memoryDir, file);
            const content = readFileSync(fullPath, "utf-8");
            memories.push({
              id: `agent-kernel-${file}`,
              source: "agent-kernel",
              timestamp: new Date().toISOString(),
              title: `Agent Kernel Memory: ${file}`,
              content,
              category: file.includes("security") ? "security" : "general",
            });
          }
        }
      }
    } catch {
      // Return accumulated memories gracefully
    }

    return memories;
  }
}
