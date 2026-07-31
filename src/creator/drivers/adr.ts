import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export interface CustomAdr {
  id?: string;
  filePath?: string;
  content: string;
}

export class AdrDriver implements MemoryDriver {
  public name: MemoryDriver["name"] = "adr";

  public async fetchMemories(options?: {
    adrDir?: string;
    customAdrs?: CustomAdr[];
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    try {
      // 1. Process custom ADR content passed via options
      if (options?.customAdrs && options.customAdrs.length > 0) {
        options.customAdrs.forEach((adr, idx) => {
          const parsed = this.parseAdrContent(adr.content, adr.filePath || `adr-${idx + 1}.md`);
          memories.push({
            id: adr.id || `adr-${idx + 1}`,
            source: "adr",
            timestamp: new Date().toISOString(),
            title: parsed.title,
            content: parsed.summary,
            category: "architecture",
            metadata: { decision: parsed.decision, context: parsed.context },
          });
        });
      }

      // 2. Scan directories for ADR markdown files
      const searchDirs: string[] = [];
      if (options?.adrDir) {
        searchDirs.push(options.adrDir);
      } else if (!options?.customAdrs || options.customAdrs.length === 0) {
        const defaults = [
          join(process.cwd(), "docs", "adr"),
          join(process.cwd(), "docs", "decisions"),
          join(process.cwd(), "docs", "architecture"),
        ];
        searchDirs.push(...defaults.filter((d) => existsSync(d)));
      }

      for (const dir of searchDirs) {
        try {
          const files = readdirSync(dir);
          for (const file of files) {
            if (file.endsWith(".md")) {
              const fullPath = join(dir, file);
              const content = readFileSync(fullPath, "utf-8");
              const parsed = this.parseAdrContent(content, file);
              memories.push({
                id: `adr-file-${file}`,
                source: "adr",
                timestamp: new Date().toISOString(),
                title: parsed.title,
                content: parsed.summary,
                category: "architecture",
                metadata: { filePath: fullPath, decision: parsed.decision },
              });
            }
          }
        } catch {
          // Continue with next directory
        }
      }
    } catch {
      // Graceful error fallback
    }

    return memories;
  }

  private parseAdrContent(content: string, fileName: string): {
    title: string;
    decision: string;
    context: string;
    summary: string;
  } {
    const lines = content.split("\n");
    let title = fileName.replace(/\.md$/, "");
    let context = "";
    let decision = "";

    let currentSection = "";

    for (const line of lines) {
      if (line.startsWith("# ")) {
        title = line.replace("# ", "").trim();
      } else if (line.toLowerCase().startsWith("## context")) {
        currentSection = "context";
      } else if (line.toLowerCase().startsWith("## decision")) {
        currentSection = "decision";
      } else if (line.startsWith("## ")) {
        currentSection = "other";
      } else if (currentSection === "context") {
        context += `${line}\n`;
      } else if (currentSection === "decision") {
        decision += `${line}\n`;
      }
    }

    const summaryParts = [
      title ? `Title: ${title}` : "",
      decision.trim() ? `Decision: ${decision.trim()}` : "",
      context.trim() ? `Context: ${context.trim()}` : "",
    ].filter(Boolean);

    return {
      title,
      decision: decision.trim(),
      context: context.trim(),
      summary: summaryParts.join("\n") || content,
    };
  }
}
