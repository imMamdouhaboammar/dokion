import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export class WorkflowOptimizerDriver implements MemoryDriver {
  public name: MemoryDriver["name"] = "workflow-optimizer";

  public async fetchMemories(options?: { projectRoot?: string }): Promise<MemoryEntry[]> {
    const root = options?.projectRoot || process.cwd();
    const memories: MemoryEntry[] = [];

    const candidates = [
      "learning_proposal.md",
      "docs/superpowers/plans/workflow-optimization.md",
      "docs/workflow-optimization.md",
      "HARDENING.md",
      "implementation_plan.md",
    ];

    for (const file of candidates) {
      const fullPath = join(root, file);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          memories.push({
            id: `workflow-${file}`,
            source: "workflow-optimizer",
            timestamp: new Date().toISOString(),
            title: `Workflow Optimization Source: ${file}`,
            content,
            category: file.includes("learning") ? "unslop" : "general",
          });
        } catch {
          // Skip unreadable files
        }
      }
    }

    return memories;
  }
}
