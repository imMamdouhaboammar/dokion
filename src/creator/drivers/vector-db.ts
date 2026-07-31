import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryDriver, MemoryEntry, MemorySourceType } from "../types.js";

export class VectorDbDriver implements MemoryDriver {
  public name: MemorySourceType;

  constructor(sourceName: MemorySourceType = "vector-db") {
    this.name = sourceName;
  }

  public async fetchMemories(options?: {
    vectorPath?: string;
    customRecords?: Array<{ id?: string; payload?: Record<string, unknown> }>;
    qdrantPoints?: Array<{ id?: string; payload?: Record<string, unknown> }>;
    chromaDocuments?: Array<{ id?: string; document?: string; metadata?: Record<string, unknown> }>;
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    try {
      // 1. Process customRecords or mock payload input
      if (options?.customRecords && options.customRecords.length > 0) {
        options.customRecords.forEach((item, idx) => {
          const payload = item.payload || {};
          memories.push({
            id: item.id || `vec-${idx}`,
            source: this.name,
            timestamp: new Date().toISOString(),
            title: String(payload.title || `Vector Record ${idx + 1}`),
            content: String(payload.content || payload.ruleDescription || JSON.stringify(payload)),
            category: (payload.category as any) || "architecture",
            metadata: payload,
          });
        });
      }

      // 2. Process Qdrant points
      if (options?.qdrantPoints && options.qdrantPoints.length > 0) {
        options.qdrantPoints.forEach((point, idx) => {
          const payload = point.payload || {};
          const title = String(payload.ruleName || payload.title || `Qdrant Point ${idx + 1}`);
          const description = String(payload.ruleDescription || payload.content || JSON.stringify(payload));
          memories.push({
            id: point.id || `qdrant-${idx}`,
            source: "qdrant",
            timestamp: new Date().toISOString(),
            title,
            content: payload.ruleName ? `${title} - ${description}` : description,
            category: "architecture",
            metadata: payload,
          });
        });
      }

      // 3. Process Chroma documents
      if (options?.chromaDocuments && options.chromaDocuments.length > 0) {
        options.chromaDocuments.forEach((doc, idx) => {
          const meta = doc.metadata || {};
          memories.push({
            id: doc.id || `chroma-${idx}`,
            source: "chromadb",
            timestamp: new Date().toISOString(),
            title: String(meta.title || `Chroma Document ${idx + 1}`),
            content: doc.document || String(meta.content || JSON.stringify(meta)),
            category: "architecture",
            metadata: meta,
          });
        });
      }

      // 4. Local vector dump file check (.dokion/vector-dump.json)
      const localDumpPath = options?.vectorPath || join(process.cwd(), ".dokion", "vector-dump.json");
      if (existsSync(localDumpPath)) {
        const raw = readFileSync(localDumpPath, "utf-8");
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : parsed.records || [];
        records.forEach((rec: any, idx: number) => {
          memories.push({
            id: rec.id || `local-vec-${idx}`,
            source: this.name,
            timestamp: rec.timestamp || new Date().toISOString(),
            title: rec.title || `Vector Dump Entry ${idx + 1}`,
            content: rec.content || JSON.stringify(rec),
            category: rec.category || "architecture",
            metadata: rec.metadata || rec,
          });
        });
      }
    } catch {
      // Return accumulated memories gracefully
    }

    return memories;
  }
}
