import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryDriver, MemoryEntry } from "../types.js";

export interface GraphTriple {
  subject: string;
  predicate: string;
  object: string;
}

export interface GraphNode {
  id?: string;
  label?: string;
  title?: string;
  relations?: string[];
  metadata?: Record<string, unknown>;
}

export class KnowledgeGraphDriver implements MemoryDriver {
  public name: MemoryDriver["name"] = "knowledge-graph";

  public async fetchMemories(options?: {
    graphPath?: string;
    triples?: GraphTriple[];
    graphNodes?: GraphNode[];
  }): Promise<MemoryEntry[]> {
    const memories: MemoryEntry[] = [];

    try {
      // 1. Process triples
      if (options?.triples && options.triples.length > 0) {
        options.triples.forEach((t, idx) => {
          memories.push({
            id: `kg-triple-${idx}`,
            source: "knowledge-graph",
            timestamp: new Date().toISOString(),
            title: `Knowledge Graph Rule: ${t.subject} ${t.predicate} ${t.object}`,
            content: `${t.subject} ${t.predicate} ${t.object}`,
            category: "architecture",
            metadata: { triple: t },
          });
        });
      }

      // 2. Process graph nodes with relations
      if (options?.graphNodes && options.graphNodes.length > 0) {
        options.graphNodes.forEach((node, idx) => {
          const title = node.label || node.title || `Graph Node ${idx + 1}`;
          const rels = node.relations ? node.relations.join("; ") : "";
          memories.push({
            id: node.id || `kg-node-${idx}`,
            source: "knowledge-graph",
            timestamp: new Date().toISOString(),
            title,
            content: rels ? `${title}: ${rels}` : title,
            category: "architecture",
            metadata: node.metadata || { node },
          });
        });
      }

      // 3. Local graph file check (.dokion/graph.json)
      const graphFile = options?.graphPath || join(process.cwd(), ".dokion", "graph.json");
      if (existsSync(graphFile)) {
        const raw = readFileSync(graphFile, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.triples)) {
          parsed.triples.forEach((t: GraphTriple, idx: number) => {
            memories.push({
              id: `local-kg-triple-${idx}`,
              source: "knowledge-graph",
              timestamp: new Date().toISOString(),
              title: `Graph Triple: ${t.subject} ${t.predicate} ${t.object}`,
              content: `${t.subject} ${t.predicate} ${t.object}`,
              category: "architecture",
              metadata: { triple: t },
            });
          });
        }
      }
    } catch {
      // Return accumulated memories gracefully
    }

    return memories;
  }
}
