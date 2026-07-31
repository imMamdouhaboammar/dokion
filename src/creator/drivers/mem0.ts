import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export class Mem0Driver implements MemoryDriver {
  public name: MemoryDriver["name"] = "mem0";

  public async fetchMemories(options?: { mem0Path?: string }): Promise<MemoryEntry[]> {
    const mem0Dir = options?.mem0Path || join(homedir(), ".mem0");
    const memories: MemoryEntry[] = [];

    if (!existsSync(mem0Dir)) {
      return memories;
    }

    try {
      const configFile = join(mem0Dir, "memories.json");
      if (existsSync(configFile)) {
        const raw = readFileSync(configFile, "utf-8");
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed) ? parsed : parsed.memories || [];

        entries.forEach((item: any, idx: number) => {
          memories.push({
            id: item.id || `mem0-${idx}`,
            source: "mem0",
            timestamp: item.timestamp || new Date().toISOString(),
            title: item.title || `Mem0 Note ${idx + 1}`,
            content: item.memory || item.content || JSON.stringify(item),
            category: "general",
          });
        });
      }
    } catch {
      // Graceful return
    }

    return memories;
  }
}
