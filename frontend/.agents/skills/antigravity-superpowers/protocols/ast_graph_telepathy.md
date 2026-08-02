# 🧠 Protocol 2: Omniscient Codebase Telepathy & AST Graph Indexing

## 1. Overview
Omniscient Codebase Telepathy gives Antigravity complete visibility into repository structure, dependency graphs, type signatures, and data flows, eliminating guesswork and preventing cascading breakages.

## 2. Core Operational Rules
1. **Context Search First (No Blind Editing)**:
   - Always run `rg` or `grep_search` to map where functions, types, and exported symbols are used across the repository.
   - Inspect `package.json`, `bun.lock`, `tsconfig.json`, or environment configs to understand project standards before modifying code.

2. **Cross-Module Impact Analysis**:
   - Trace function invocations across registry files, interfaces, and API contracts.
   - When modifying a function signature, update every invocation site in the same step.

3. **No Snippet Tunnel Vision**:
   - Never infer class or database schema definitions from partial 10-line snippets.
   - Read full target definitions (`view_file` with complete line ranges) before implementing consumers.

4. **Schema Lineage Tracing**:
   - For database schemas (Supabase, PostgreSQL, Prisma, Drizzle), trace data types from the database layer through API endpoints to the frontend UI components.
