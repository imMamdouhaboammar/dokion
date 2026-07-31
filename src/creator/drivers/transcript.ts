import { existsSync, readFileSync } from "node:fs";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export class TranscriptLogDriver implements MemoryDriver {
  public name: MemoryDriver["name"] = "transcript";

  public async fetchMemories(options?: { transcriptPath?: string; conversationId?: string }): Promise<MemoryEntry[]> {
    const filePath = options?.transcriptPath;
    if (!filePath || !existsSync(filePath)) {
      return [];
    }

    const memories: MemoryEntry[] = [];
    try {
      const rawContent = readFileSync(filePath, "utf-8");
      const lines = rawContent.split("\n").filter((line) => line.trim().length > 0);

      let stepIndex = 0;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const type = parsed.type || parsed.source || "LOG";
          const content = typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content || parsed);

          // Focus on user instructions, tool calls, and model planner responses
          if (type === "USER_INPUT" || type === "PLANNER_RESPONSE" || parsed.tool_calls || content.includes("npx skills add") || content.includes("run_command")) {
            stepIndex++;
            memories.push({
              id: `transcript-step-${stepIndex}`,
              source: "transcript",
              timestamp: parsed.timestamp || new Date().toISOString(),
              title: `Transcript Step ${stepIndex} [${type}]`,
              content,
              category: content.toLowerCase().includes("security") ? "security" : content.toLowerCase().includes("ui") ? "ui-ux" : "general",
              metadata: { tool_calls: parsed.tool_calls, raw: parsed },
            });
          }
        } catch {
          // Skip invalid JSON lines gracefully
        }
      }
    } catch {
      // Graceful return
    }

    return memories;
  }
}
