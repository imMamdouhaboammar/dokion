# Design Specification: Advanced Knowledge & Vector Memory Drivers

**Date**: 2026-08-01  
**Status**: Proposed  
**Author**: Engineering Team  

---

## 1. Executive Summary

This design specification details the expansion of `PlaybookCreatorEngine` in Dokion to support advanced vector database memory drivers, knowledge graphs, Architecture Decision Records (ADRs), and GitHub PR/Issue discussion drivers. These extended memory drivers enable Dokion to autonomously synthesize reproducible playbooks from enterprise knowledge repositories, ADRs, vector databases (Qdrant, ChromaDB), knowledge graphs, and GitHub code review conversations.

---

## 2. Architecture & Component Design

```
+-------------------------------------------------------------------------+
|                        PlaybookCreatorEngine                            |
+-------------------------------------------------------------------------+
                                   |
                     +-------------+-------------+
                     |                           |
        +-------------------------+  +-----------------------+
        |  MemoryDriverRegistry   |  |  PlaybookInterpreter  |
        +-------------------------+  +-----------------------+
                     |                           |
    +----------------+----------------+          |
    |                |                |          |
+-------+        +-------+        +-------+      |
| Vector|        | KGraph|        |  ADR  |      |
| Driver|        | Driver|        | Driver|      |
+-------+        +-------+        +-------+      |
    |                |                |          |
+-------+        +-------+            |          |
|GitHub |        | Mem0  |            |          |
|  PR   |        | Kernel|            v          v
+-------+        +-------+    +-----------------------+
                              |   PlaybookCompiler    |
                              +-----------------------+
                                         |
                                         v
                              +-----------------------+
                              | Dokion Playbook (.json)|
                              +-----------------------+
```

---

## 3. Detailed Memory Drivers

### 3.1 Vector DB Driver (`vector-db`, `qdrant`, `chromadb`)
- **Purpose**: Query Qdrant or ChromaDB instances (or local vector database dumps/REST APIs) to retrieve embedded Architecture Decision Records (ADRs) and engineering rules.
- **Capabilities**:
  - Connects via HTTP/REST or local vector dump file.
  - Queries collections filtering by metadata (`doc_type: "adr"`, `category: "architecture"`, etc.).
  - Extracts payload fields (e.g. `decision`, `context`, `consequences`, `rule`) into structured `MemoryEntry` items.

### 3.2 Knowledge Graph Driver (`knowledge-graph`)
- **Purpose**: Ingest entity-relation triples or graph nodes (JSON-LD, Neo4j export, or local `.dokion/graph.json` files).
- **Capabilities**:
  - Traverses architectural decision nodes and dependency relationships.
  - Formats graph triples (e.g., `[ServiceA] --(mandates)--> [StrictAuthPolicy]`) into contextual `MemoryEntry` items.

### 3.3 Architecture Decision Record (ADR) Driver (`adr`)
- **Purpose**: Scan local directory paths (`docs/adr/`, `docs/decisions/`, `docs/architecture/`) for Markdown ADRs.
- **Capabilities**:
  - Parses MADR (Markdown Architectural Decision Records) standards.
  - Extracts Title, Context, Decision, Rationale, and Consequences into high-priority architectural rules for playbook generation.

### 3.4 GitHub PR & Issue Driver (`github-pr`, `github-issue`)
- **Purpose**: Read PR review comment threads, issue discussions, and recommendation logs.
- **Capabilities**:
  - Parses local exported PR discussions or fetches via GitHub REST API / gh CLI.
  - Extracts reviewer recommendations (e.g. "Ensure unit tests cover boundary conditions", "Use conventional commits").
  - Maps PR discussions directly into actionable memory steps.

---

## 4. System Types & Interfaces

```typescript
export type MemorySourceType =
  | "agent-kernel"
  | "transcript"
  | "mem0"
  | "workflow-optimizer"
  | "vector-db"
  | "qdrant"
  | "chromadb"
  | "knowledge-graph"
  | "adr"
  | "github-pr"
  | "github-issue"
  | "manual";

export interface MemoryEntry {
  id: string;
  source: MemorySourceType;
  timestamp: string;
  title: string;
  content: string;
  category?: "ui-ux" | "security" | "backend" | "testing" | "unslop" | "general" | "architecture";
  metadata?: Record<string, unknown>;
}
```

---

## 5. Verification & Testing Strategy

1. **Unit Tests**:
   - `tests/creator/vector-db.test.ts`: Test Qdrant and ChromaDB payload parsing & filtering.
   - `tests/creator/knowledge-graph.test.ts`: Test graph triple extraction and relation parsing.
   - `tests/creator/adr.test.ts`: Test MADR parser scanning `docs/adr/`.
   - `tests/creator/github-pr.test.ts`: Test PR review comment thread parsing.

2. **Integration Tests**:
   - `tests/creator/advanced-memory-integration.test.ts`: End-to-end playbook synthesis combining ADRs, Vector DB search results, Knowledge Graphs, and GitHub PR recommendations.

---

## 6. Security & Safety Controls
- **No Private Credentials**: Vector DB and GitHub API tokens are read securely from environment variables (`QDRANT_API_KEY`, `GITHUB_TOKEN`, `CHROMADB_URL`) or local config without logging.
- **Offline / Mock Fallbacks**: All drivers operate deterministically offline when no external API endpoint is available, using local files or mock fallbacks.
