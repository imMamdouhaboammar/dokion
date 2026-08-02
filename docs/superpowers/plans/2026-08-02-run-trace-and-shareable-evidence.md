# Run Trace and Shareable Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Produce one deterministic, qualified, shareable record for every Dokion run so users can see what executed, what changed, what failed, what rolled back, and why the final state is or is not ready

**Architecture:** Add a versioned `dokion.run-trace.v1` projection over verified state, event journal, approvals, findings, repair transactions, and evidence manifests. Render the projection to terminal, JSON, Markdown, and self-contained static HTML without changing runtime authority

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, existing StateStore, event journal, finding store, evidence manifests, atomic writes, Bun test

## Global Constraints

- The Run Trace is a projection and grants no execution authority
- Every displayed command, finding, approval, repair, rollback, and evidence artifact must come from persisted records
- Missing proof must render as `unavailable or unproven`
- A completed process is not automatically a ready repository
- HTML output must contain no remote scripts, remote fonts, telemetry, or executable package content
- Paths exposed outside the repository must remain repository-relative and credential-free
- JSON ordering and Markdown ordering must be deterministic

---

### Task 1: Define the versioned Run Trace contract

**Files:**
- Create: `schemas/dokion-run-trace.schema.json`
- Create: `src/trace/types.ts`
- Create: `tests/trace/run-trace-schema.test.ts`
- Modify: `schemas/conformance_test.py`
- Modify: `scripts/validate-distribution.ts`

**Interfaces:**
- Produces schema ID: `dokion.run-trace.v1`
- Produces TypeScript type: `DokionRunTraceV1`

- [ ] **Step 1: Write failing schema conformance tests**

Require these top-level fields

```ts
interface DokionRunTraceV1 {
  schema_version: "dokion.run-trace.v1"
  run: RunTraceIdentity
  repository: RunTraceRepository
  playbook: RunTracePlaybook
  platform: RunTracePlatform
  stages: RunTraceStage[]
  findings: RunTraceFindingSummary
  repairs: RunTraceRepairSummary
  decisions: RunTraceDecision[]
  blockers: RunTraceBlocker[]
  evidence: RunTraceEvidence[]
  readiness: RunTraceReadiness
  integrity: RunTraceIntegrity
}
```

Reject unknown top-level fields, absolute paths, missing digests, generic `verified` booleans, negative counters, duplicate evidence IDs, and readiness claims without a qualification string

- [ ] **Step 2: Run conformance and confirm RED**

Run

```bash
python3 schemas/conformance_test.py
bun test tests/trace/run-trace-schema.test.ts
```

Expected result: failure because the schema and types do not exist

- [ ] **Step 3: Implement the schema and matching types**

Separate these trust states rather than using one boolean

- state schema valid
- event chain valid
- playbook digest stable
- repository identity current
- evidence manifest valid
- repair rollback confirmed

- [ ] **Step 4: Add valid and invalid fixtures**

Create fixtures under `tests/fixtures/run-trace/` for completed, blocked, stale, tainted, rollback, and missing-evidence states

- [ ] **Step 5: Run schema and distribution checks**

Run

```bash
python3 schemas/conformance_test.py
bun test tests/trace/run-trace-schema.test.ts
bun run validate:distribution
```

Expected result: the schema is embedded and every fixture behaves as declared

- [ ] **Step 6: Commit**

```bash
git add schemas/dokion-run-trace.schema.json src/trace/types.ts tests/trace/run-trace-schema.test.ts tests/fixtures/run-trace schemas/conformance_test.py scripts/validate-distribution.ts
git commit -m "feat: define Run Trace v1 contract"
```

### Task 2: Build the verified Run Trace projection

**Files:**
- Create: `src/trace/build-run-trace.ts`
- Create: `src/trace/read-run-evidence.ts`
- Create: `src/trace/read-repair-summary.ts`
- Create: `tests/trace/build-run-trace.test.ts`
- Modify: `src/report/render-hardening.ts`

**Interfaces:**
- Produces: `buildRunTrace(root: string, runId?: string): Promise<DokionRunTraceV1>`
- Consumes: StateStore, verified event chain, findings, approvals, evidence manifests, repair transaction manifests

- [ ] **Step 1: Write failing projection tests**

Cover

- Completed run with passing declared gates
- Blocked run with missing capability
- Repair accepted after verification
- Repair rejected and rollback confirmed
- Repair failure without rollback proof
- Tainted Playbook digest
- Stale repository identity
- Missing evidence file
- Credential-bearing source URL that must be redacted

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/trace/build-run-trace.test.ts`

Expected result: failure because the projection does not exist

- [ ] **Step 3: Implement evidence-first projection**

Read the state through `StateStore`

Verify the event journal before using event-derived facts

Open evidence and repair manifests through existing no-follow and bounded read utilities

Use repository-relative paths only

Sort stages by declared Playbook order, findings by stable ID, decisions by recorded sequence, and evidence by artifact ID

- [ ] **Step 4: Centralize qualified readiness**

Move readiness wording out of ad hoc renderers into one trace readiness function

Use these outcomes

```text
READY_WITHIN_DECLARED_SCOPE
NOT_READY
CONDITIONALLY_READY
NO_COMPLETION_CLAIM
TAINTED
STALE
```

Every outcome includes exact reasons, uncovered areas, platform degradations, skipped steps, manual checks, and accepted risks

- [ ] **Step 5: Refactor HARDENING.md to consume the projection**

`renderHardeningMarkdown` must render from `DokionRunTraceV1` rather than reconstructing claims directly from state

Keep a compatibility wrapper for existing callers during the same PR

- [ ] **Step 6: Run focused and report tests**

Run

```bash
bun test tests/trace/build-run-trace.test.ts tests/report/compare-runs.test.ts
bun run typecheck
```

Expected result: all outputs share one qualified source

- [ ] **Step 7: Commit**

```bash
git add src/trace src/report/render-hardening.ts tests/trace/build-run-trace.test.ts
git commit -m "feat: build evidence-backed Run Trace"
```

### Task 3: Add terminal and deterministic JSON trace commands

**Files:**
- Modify: `src/cli/types.ts`
- Modify: `src/cli/parser.ts`
- Modify: `src/cli/command-registry.ts`
- Modify: `src/cli.ts`
- Create: `src/cli/handlers/trace.ts`
- Create: `src/trace/render-terminal.ts`
- Create: `tests/cli/trace-command.test.ts`

**Interfaces:**
- Adds: `dokion trace`
- Adds: `dokion trace --run <run-id>`
- Adds: existing global `--json` and `--ndjson` formats where supported by the parser contract

- [ ] **Step 1: Write failing parser and command tests**

Assert

- Default command reads the current run
- Explicit run ID reads an archived run only when evidence exists
- Unknown run ID fails with `RUN_TRACE_NOT_FOUND`
- Broken event integrity fails with `EVIDENCE_CHAIN_BROKEN`
- Human and JSON outputs describe the same status, blocker count, finding count, and readiness outcome

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/cli/trace-command.test.ts`

Expected result: command is not registered

- [ ] **Step 3: Implement terminal rendering**

Render this order

```text
Run and repository
Final outcome
Active blockers
Stage progress
Findings
Repairs and rollbacks
Approvals and skips
Platform degradations
Evidence locations
Qualified readiness statement
```

Do not use decorative success language when blockers or unproven checks exist

- [ ] **Step 4: Register deterministic JSON output**

Return the exact schema object without terminal-only aliases

- [ ] **Step 5: Run command and product flow tests**

Run

```bash
bun test tests/cli/trace-command.test.ts tests/cli/product-flow.test.ts
bun run typecheck
bun run build
```

Expected result: human and machine output remain consistent

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/cli/types.ts src/cli/parser.ts src/cli/command-registry.ts src/cli/handlers/trace.ts src/trace/render-terminal.ts tests/cli/trace-command.test.ts
git commit -m "feat: add Run Trace CLI"
```

### Task 4: Add Markdown and self-contained HTML exports

**Files:**
- Create: `src/trace/render-markdown.ts`
- Create: `src/trace/render-html.ts`
- Create: `src/trace/export-run-trace.ts`
- Create: `tests/trace/run-trace-export.test.ts`
- Modify: `src/cli/handlers/trace.ts`
- Modify: `src/cli/parser.ts`
- Modify: `src/cli/command-registry.ts`

**Interfaces:**
- Adds: `dokion trace export --format json|markdown|html --output <path>`
- Produces default paths under `.dokion/reports/<run-id>/`

- [ ] **Step 1: Write failing export tests**

Require

- Atomic writes
- Refusal to overwrite without `--overwrite`
- No absolute internal paths
- No remote script, style, image, font, or link dependency in HTML
- HTML escapes all state and finding content
- Markdown and HTML display the same readiness outcome and blocker set
- JSON validates against `dokion.run-trace.v1`

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/trace/run-trace-export.test.ts`

Expected result: exporters do not exist

- [ ] **Step 3: Implement Markdown rendering**

Use semantic headings and tables with stable ordering

Link evidence using repository-relative paths only

- [ ] **Step 4: Implement static HTML rendering**

Use inline CSS only

Use semantic `header`, `nav`, `main`, `section`, `table`, and `footer` elements

Include a skip link, visible focus styles, responsive tables, print styles, and reduced-motion-safe behavior

Do not include client-side JavaScript in v1

- [ ] **Step 5: Implement atomic export**

Validate the trace object before rendering and validate output paths against the repository boundary

- [ ] **Step 6: Run focused, security, and distribution checks**

Run

```bash
bun test tests/trace/run-trace-export.test.ts
bun run typecheck
bun run validate:distribution
```

Expected result: every format is deterministic and safe to share

- [ ] **Step 7: Commit**

```bash
git add src/trace/render-markdown.ts src/trace/render-html.ts src/trace/export-run-trace.ts src/cli/handlers/trace.ts src/cli/parser.ts src/cli/command-registry.ts tests/trace/run-trace-export.test.ts
git commit -m "feat: export shareable Run Trace reports"
```

### Task 5: Integrate Run Trace into run, verify, audit, and Pack journeys

**Files:**
- Modify: `src/engine/execution-engine.ts`
- Modify: `src/cli/handlers/verify.ts`
- Modify: `src/cli/handlers/audit.ts`
- Modify: `src/cli/handlers/try-pack.ts`
- Modify: `src/cli.ts`
- Create: `tests/acceptance/run-trace-lifecycle.test.ts`

**Interfaces:**
- Produces updated trace exports at terminal states
- Does not hide the original operation result when trace export fails

- [ ] **Step 1: Write failing lifecycle tests**

Cover completed, failed, blocked, awaiting approval, stale, tainted, and rollback terminal states

Assert that each terminal transition has a trace JSON artifact and that export failure produces a visible secondary diagnostic rather than changing a failed run into success

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/acceptance/run-trace-lifecycle.test.ts`

Expected result: lifecycle commands do not produce trace artifacts

- [ ] **Step 3: Add trace checkpoints**

Generate or refresh deterministic JSON and Markdown after terminal state persistence and after audit reconciliation

Do not generate a final readiness statement before state and evidence writes complete

- [ ] **Step 4: Return trace paths from CLI commands**

Add `trace_json`, `trace_markdown`, and `trace_html` only when the corresponding artifacts exist

- [ ] **Step 5: Run complete lifecycle tests**

Run

```bash
bun test tests/acceptance/run-trace-lifecycle.test.ts tests/acceptance/secure-release-journey.test.ts
bun test
bun run typecheck
bun run build
```

Expected result: every supported terminal state has a truthful trace

- [ ] **Step 6: Commit**

```bash
git add src/engine/execution-engine.ts src/cli/handlers/verify.ts src/cli/handlers/audit.ts src/cli/handlers/try-pack.ts src/cli.ts tests/acceptance/run-trace-lifecycle.test.ts
git commit -m "feat: attach Run Trace to lifecycle commands"
```

### Task 6: Add documentation and generated examples

**Files:**
- Create: `docs/concepts/run-trace.md`
- Create: `scripts/generate-run-trace-examples.ts`
- Create: `generated/examples/run-trace-completed.json`
- Create: `generated/examples/run-trace-blocked.json`
- Modify: `docs/packs/secure-release.md`
- Modify: `tests/docs/onboarding-smoke.test.ts`

**Interfaces:**
- Consumes: seeded acceptance fixtures
- Produces: examples tied to exact fixture commits and schema validation

- [ ] **Step 1: Add failing generated-example tests**

Require examples to validate against the schema, contain no absolute paths, and match the latest fixture output

- [ ] **Step 2: Generate completed and blocked examples**

Use the installed CLI against maintained fixtures rather than hand-writing example JSON

- [ ] **Step 3: Document interpretation**

Explain outcome, blockers, readiness qualification, repair status, platform degradations, evidence, and integrity states

- [ ] **Step 4: Run docs and release truth gates**

Run

```bash
bun run generate:run-trace-examples
bun test tests/docs/onboarding-smoke.test.ts
bun run validate:public-claims
bun run validate:release-truth
```

Expected result: documentation examples cannot drift from executable output

- [ ] **Step 5: Commit**

```bash
git add docs/concepts/run-trace.md docs/packs/secure-release.md scripts/generate-run-trace-examples.ts generated/examples tests/docs/onboarding-smoke.test.ts package.json
git commit -m "docs: publish generated Run Trace examples"
```

## PR Completion Gate

The PR is complete only when JSON schema conformance passes, terminal and export outputs agree, HTML contains no remote or executable content, corrupted evidence fails closed, every terminal run state produces a qualified trace, CodeRabbit critical and major issues are resolved, and full repository gates pass on the current branch head
