# Advanced Knowledge & Vector Memory Drivers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Dokion's `PlaybookCreatorEngine` with advanced memory drivers for Vector DBs (Qdrant & ChromaDB), Knowledge Graphs, Architecture Decision Records (ADRs), and GitHub PR/Issue discussion threads.

**Architecture:** Add four modular memory drivers implementing the `MemoryDriver` interface into `src/creator/drivers/`, update creator types and memory driver registry, update CLI handlers to expose new memory sources, and verify end-to-end playbook generation from ADRs, Vector DBs, Knowledge Graphs, and PR discussions.

**Tech Stack:** TypeScript, Node.js (`fs`, `path`, `crypto`), Bun test runner.

## Global Constraints

- Never expose credentials or API keys.
- Offline and local-fallback operation is mandatory for all memory drivers when network or API endpoints are unreachable.
- Follow TDD: write unit tests first, verify failure, implement code, verify pass, and commit cleanly.

---

### Task 1: Extend Creator Types & Memory Source Registry

**Files:**
- Modify: `src/creator/types.ts`
- Modify: `src/creator/drivers/index.ts`
- Modify: `src/cli/handlers/creator.ts`
- Test: `tests/creator/types-and-registry.test.ts`

**Interfaces:**
- Consumes: Existing `MemoryDriver`, `MemoryEntry`, `MemorySourceType`
- Produces: Extended `MemorySourceType` union supporting `"vector-db" | "qdrant" | "chromadb" | "knowledge-graph" | "adr" | "github-pr" | "github-issue"`

- [ ] **Step 1: Write the failing test for expanded registry & types**

```typescript
import { expect, test, describe } from "bun:test";
import { MemoryDriverRegistry } from "../../src/creator/drivers/index.js";

describe("Extended Memory Driver Registry", () => {
  test("registers new advanced memory drivers", () => {
    const registry = new MemoryDriverRegistry();
    expect(registry.get("vector-db")).toBeDefined();
    expect(registry.get("knowledge-graph")).toBeDefined();
    expect(registry.get("adr")).toBeDefined();
    expect(registry.get("github-pr")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/creator/types-and-registry.test.ts`  
Expected: FAIL with missing drivers or missing types.

- [ ] **Step 3: Update `src/creator/types.ts` and `src/creator/drivers/index.ts`**

Update `MemorySourceType`:
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/types-and-registry.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/creator/types.ts tests/creator/types-and-registry.test.ts
git commit -m "feat(creator): extend MemorySourceType union and registry tests"
```

---

### Task 2: Vector DB Memory Driver (`VectorDbDriver`)

**Files:**
- Create: `src/creator/drivers/vector-db.ts`
- Modify: `src/creator/drivers/index.ts`
- Test: `tests/creator/vector-db.test.ts`

**Interfaces:**
- Consumes: `MemoryDriver`, `MemoryEntry`
- Produces: `VectorDbDriver` class supporting Qdrant, ChromaDB, and local vector dump search results.

- [ ] **Step 1: Write failing unit test for VectorDbDriver**

```typescript
import { expect, test, describe } from "bun:test";
import { VectorDbDriver } from "../../src/creator/drivers/vector-db.js";

describe("VectorDbDriver", () => {
  test("fetches vector search entries from options or local payload", async () => {
    const driver = new VectorDbDriver();
    const memories = await driver.fetchMemories({
      customRecords: [
        {
          id: "vec-1",
          payload: {
            title: "ADR-005: Use Vector Search for Rule Retrieval",
            content: "Developers must use Qdrant for semantic rule retrieval.",
            category: "architecture",
          },
        },
      ],
    });

    expect(memories.length).toBe(1);
    expect(memories[0].title).toContain("ADR-005");
    expect(memories[0].source).toBe("vector-db");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/creator/vector-db.test.ts`  
Expected: FAIL ("Cannot find module VectorDbDriver")

- [ ] **Step 3: Implement `VectorDbDriver` in `src/creator/drivers/vector-db.ts`**

Implement Qdrant / ChromaDB payload extraction and local file/record fallbacks into clean `MemoryEntry[]`.

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/vector-db.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/creator/drivers/vector-db.ts src/creator/drivers/index.ts tests/creator/vector-db.test.ts
git commit -m "feat(creator): implement VectorDbDriver for Qdrant and ChromaDB rule extraction"
```

---

### Task 3: Knowledge Graph Memory Driver (`KnowledgeGraphDriver`)

**Files:**
- Create: `src/creator/drivers/knowledge-graph.ts`
- Modify: `src/creator/drivers/index.ts`
- Test: `tests/creator/knowledge-graph.test.ts`

**Interfaces:**
- Consumes: `MemoryDriver`, `MemoryEntry`
- Produces: `KnowledgeGraphDriver` class parsing entity-relation triples and graph nodes.

- [ ] **Step 1: Write failing unit test for KnowledgeGraphDriver**

```typescript
import { expect, test, describe } from "bun:test";
import { KnowledgeGraphDriver } from "../../src/creator/drivers/knowledge-graph.js";

describe("KnowledgeGraphDriver", () => {
  test("parses knowledge graph triples into memory entries", async () => {
    const driver = new KnowledgeGraphDriver();
    const memories = await driver.fetchMemories({
      triples: [
        { subject: "ServiceA", predicate: "mandates", object: "StrictAuthCheck" },
        { subject: "DatabaseB", predicate: "requires", object: "SSLConnection" },
      ],
    });

    expect(memories.length).toBe(2);
    expect(memories[0].content).toContain("ServiceA mandates StrictAuthCheck");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/creator/knowledge-graph.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `KnowledgeGraphDriver` in `src/creator/drivers/knowledge-graph.ts`**

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/knowledge-graph.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/creator/drivers/knowledge-graph.ts src/creator/drivers/index.ts tests/creator/knowledge-graph.test.ts
git commit -m "feat(creator): implement KnowledgeGraphDriver for architectural triple ingestion"
```

---

### Task 4: ADR Memory Driver (`AdrDriver`)

**Files:**
- Create: `src/creator/drivers/adr.ts`
- Modify: `src/creator/drivers/index.ts`
- Test: `tests/creator/adr.test.ts`

**Interfaces:**
- Consumes: `MemoryDriver`, `MemoryEntry`
- Produces: `AdrDriver` scanning `docs/adr/` or markdown decision files.

- [ ] **Step 1: Write failing unit test for AdrDriver**

```typescript
import { expect, test, describe } from "bun:test";
import { AdrDriver } from "../../src/creator/drivers/adr.ts";

describe("AdrDriver", () => {
  test("parses markdown ADR content into memory entries", async () => {
    const driver = new AdrDriver();
    const memories = await driver.fetchMemories({
      customAdrs: [
        {
          id: "adr-001",
          filePath: "docs/adr/001-atomic-commits.md",
          content: "# ADR-001: Atomic Commit Policy\n\n## Status\nAccepted\n\n## Context\nCommits must be atomic.\n\n## Decision\nEvery PR must beSquashed and Atomic.\n\n## Consequences\nClean history.",
        },
      ],
    });

    expect(memories.length).toBe(1);
    expect(memories[0].title).toBe("ADR-001: Atomic Commit Policy");
    expect(memories[0].content).toContain("Every PR must beSquashed and Atomic");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/creator/adr.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `AdrDriver` in `src/creator/drivers/adr.ts`**

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/adr.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/creator/drivers/adr.ts src/creator/drivers/index.ts tests/creator/adr.test.ts
git commit -m "feat(creator): implement AdrDriver for markdown ADR scanning and rule extraction"
```

---

### Task 5: GitHub PR & Issue Discussion Driver (`GitHubPrDriver`)

**Files:**
- Create: `src/creator/drivers/github-pr.ts`
- Modify: `src/creator/drivers/index.ts`
- Test: `tests/creator/github-pr.test.ts`

**Interfaces:**
- Consumes: `MemoryDriver`, `MemoryEntry`
- Produces: `GitHubPrDriver` parsing PR comments and issue recommendations.

- [ ] **Step 1: Write failing unit test for GitHubPrDriver**

```typescript
import { expect, test, describe } from "bun:test";
import { GitHubPrDriver } from "../../src/creator/drivers/github-pr.js";

describe("GitHubPrDriver", () => {
  test("extracts PR review suggestions into actionable memories", async () => {
    const driver = new GitHubPrDriver();
    const memories = await driver.fetchMemories({
      customPrs: [
        {
          prNumber: 42,
          title: "Fix authentication flow",
          comments: [
            {
              author: "lead-dev",
              body: "Always verify JWT signatures using RSA-256 before granting admin access.",
            },
          ],
        },
      ],
    });

    expect(memories.length).toBe(1);
    expect(memories[0].content).toContain("Always verify JWT signatures");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/creator/github-pr.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `GitHubPrDriver` in `src/creator/drivers/github-pr.ts`**

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/github-pr.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/creator/drivers/github-pr.ts src/creator/drivers/index.ts tests/creator/github-pr.test.ts
git commit -m "feat(creator): implement GitHubPrDriver for PR and issue discussion playbook extraction"
```

---

### Task 6: End-to-End Creator Integration Test & CLI Validation

**Files:**
- Modify: `src/creator/drivers/index.ts`
- Modify: `src/creator/engine.ts`
- Modify: `src/cli/handlers/creator.ts`
- Test: `tests/creator/advanced-memory-integration.test.ts`

- [ ] **Step 1: Write failing integration test for full engine creation with advanced drivers**

```typescript
import { expect, test, describe } from "bun:test";
import { PlaybookCreatorEngine } from "../../src/creator/engine.js";

describe("PlaybookCreatorEngine with Advanced Memory Drivers", () => {
  test("synthesizes playbook from combined ADR, Vector DB, Knowledge Graph, and PR sources", async () => {
    const engine = new PlaybookCreatorEngine();
    const result = await engine.createPlaybook({
      topic: "Architecture & Code Review Best Practices",
      source: "adr",
      customMemories: [
        {
          id: "mem-adr-1",
          source: "adr",
          timestamp: new Date().toISOString(),
          title: "ADR-010: Strict Type Checking",
          content: "Enforce strict TypeScript compiler flags across all modules.",
          category: "architecture",
        },
        {
          id: "mem-vec-1",
          source: "vector-db",
          timestamp: new Date().toISOString(),
          title: "Vector Search: Qdrant Rule",
          content: "Use Bun test runner with atomic assertions.",
          category: "testing",
        },
      ],
    });

    expect(result.success).toBeTrue();
    expect(result.extractedStepsCount).toBeGreaterThan(0);
    expect(result.playbook.title).toContain("Architecture & Code Review Best Practices");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/creator/advanced-memory-integration.test.ts`  
Expected: FAIL

- [ ] **Step 3: Update `src/creator/drivers/index.ts` and `src/cli/handlers/creator.ts`**

Register `VectorDbDriver`, `KnowledgeGraphDriver`, `AdrDriver`, `GitHubPrDriver` in `MemoryDriverRegistry`. Update CLI creator handler choices.

- [ ] **Step 4: Run test to verify pass**

Run: `bun test tests/creator/advanced-memory-integration.test.ts`  
Expected: PASS

- [ ] **Step 5: Run full test suite to guarantee 0 regressions**

Run: `bun test`  
Expected: All tests pass cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/creator/ src/cli/handlers/creator.ts tests/creator/
git commit -m "feat(creator): complete integration of Advanced Knowledge & Vector Memory Drivers"
```
