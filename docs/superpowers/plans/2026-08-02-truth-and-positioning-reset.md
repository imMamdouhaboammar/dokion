# Dokion Truth and Positioning Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Make every public Dokion command, integration claim, workflow description, and product promise match executable repository behavior

**Architecture:** Introduce one generated product-surface snapshot sourced from the canonical CLI registry, platform adapter contracts, shipped Packs, and Registry status. Documentation and launch checks consume the snapshot and fail when prose claims unsupported behavior

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, Bun test, existing CLI registry, Markdown documentation contracts

## Global Constraints

- `.dokion/playbook.json` remains the sole execution authority
- No new capability installation, activation, or execution behavior belongs in this plan
- Public claims require command, implementation, test, fixture, schema, or release evidence
- Human and JSON CLI outputs must describe the same capability state
- Do not present subagent isolation, parallel writes, worktree isolation, or cross-agent parity as universal guarantees
- Preserve fail-closed Registry wording for unavailable lifecycle operations

---

### Task 1: Add a canonical product-surface snapshot

**Files:**
- Create: `src/product/product-surface.ts`
- Create: `src/product/types.ts`
- Create: `scripts/generate-product-surface.ts`
- Create: `tests/product/product-surface.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildProductSurface(): ProductSurface`
- Produces: `writeProductSurfaceSnapshot(root: string): Promise<string>`
- Produces: `generated/product-surface.json`

- [ ] **Step 1: Write a failing contract test**

Create a test that requires the snapshot to include the exact implemented command names from `src/cli/command-registry.ts`, explicit status values `IMPLEMENTED`, `EXPERIMENTAL`, `PLANNED`, `UNAVAILABLE`, platform guarantees, shipped Pack IDs, and Registry lifecycle status

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/product/product-surface.test.ts`

Expected result: failure because `buildProductSurface` and the generated snapshot do not exist

- [ ] **Step 3: Implement typed snapshot generation**

Define these stable types

```ts
export type ProductSurfaceStatus = "IMPLEMENTED" | "EXPERIMENTAL" | "PLANNED" | "UNAVAILABLE"

export interface ProductSurfaceEntry {
  id: string
  status: ProductSurfaceStatus
  evidence: string[]
}

export interface ProductSurface {
  schema_version: "dokion.product-surface.v1"
  commands: ProductSurfaceEntry[]
  integrations: ProductSurfaceEntry[]
  packs: ProductSurfaceEntry[]
  registry: ProductSurfaceEntry[]
  generated_from_version: string
}
```

Build entries only from imported canonical registries and explicit constants, sort every list by `id`, and reject duplicate IDs

- [ ] **Step 4: Add deterministic generation script**

Add package script

```json
"generate:product-surface": "bun run scripts/generate-product-surface.ts"
```

Write JSON through the existing atomic file utility and verify a second run produces identical bytes

- [ ] **Step 5: Run focused and full contract checks**

Run

```bash
bun test tests/product/product-surface.test.ts
bun run generate:product-surface
bun run validate:contracts
```

Expected result: all pass and `generated/product-surface.json` is deterministic

- [ ] **Step 6: Commit**

```bash
git add src/product scripts/generate-product-surface.ts tests/product/product-surface.test.ts generated/product-surface.json package.json
git commit -m "feat: generate canonical product surface"
```

### Task 2: Add claim linting for public documentation

**Files:**
- Create: `scripts/validate-public-claims.ts`
- Create: `tests/contracts/public-claims.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `generated/product-surface.json`
- Produces: non-zero exit with file path, line, claim ID, and missing evidence

- [ ] **Step 1: Write failing tests for current unsupported claims**

Add fixtures proving the validator rejects

- A universal `multi-agent swarms` claim without a supported integration capability
- `dokion playbooks import --from superpowers` when `superpowers` is not a registered built-in source
- A claim that `dokion verify` runs build and test gates when the command implementation only validates contracts
- A universal automatic rollback claim without a declared repair transaction
- An integration claim absent from the generated integration list

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/contracts/public-claims.test.ts`

Expected result: failure because no validator exists

- [ ] **Step 3: Implement exact claim annotations**

Require capability-sensitive prose to use one of these markers

```markdown
<!-- dokion-claim command:verify status:IMPLEMENTED -->
<!-- dokion-claim integration:claude-code status:IMPLEMENTED -->
<!-- dokion-claim capability:subagent-isolation status:EXPERIMENTAL -->
```

Reject unknown IDs, mismatched status, unsupported command examples, and claims that omit an evidence-backed marker

- [ ] **Step 4: Add the validation script to repository gates**

Add package script

```json
"validate:public-claims": "bun run scripts/validate-public-claims.ts"
```

Call it from `validate:distribution`

- [ ] **Step 5: Verify negative and positive fixtures**

Run

```bash
bun test tests/contracts/public-claims.test.ts
bun run validate:public-claims
```

Expected result: fixtures behave as declared and current public files report the exact unsupported lines that need correction

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-public-claims.ts tests/contracts/public-claims.test.ts package.json
git commit -m "test: reject unsupported public claims"
```

### Task 3: Repair README and onboarding commands

**Files:**
- Modify: `README.md`
- Modify: `docs/getting-started/onboarding.md`
- Modify: `docs/launch/positioning-strategy.md`
- Modify: `docs/launch/marketing-launch-kit.md`
- Modify: `tests/docs/onboarding-smoke.test.ts`

**Interfaces:**
- Consumes: `generated/product-surface.json`
- Produces: one truthful quickstart using only registered commands

- [ ] **Step 1: Extend onboarding smoke tests**

Require every shell command in the quickstart to parse through `parseCliInvocation`

Require the quickstart to include creation or selection of an active Playbook before `dokion plan` or `dokion run`

Require Registry and Pack states to be labeled independently

- [ ] **Step 2: Run the focused test and confirm the current docs fail**

Run `bun test tests/docs/onboarding-smoke.test.ts`

Expected result: failure on unsupported import examples, missing activation boundary, or overstated behavior

- [ ] **Step 3: Replace the top-level message**

Use this product statement

```text
Dokion is an execution control layer for repeatable engineering Playbooks across coding agents and local tools
```

Use this supporting line

```text
It preserves order, permissions, state, evidence, verification boundaries, and rollback decisions without selecting capabilities for the user
```

Remove blanket swarm language and replace it with exact platform guarantee wording

- [ ] **Step 4: Publish a truthful current quickstart**

The initial quickstart must use commands already implemented on the branch at implementation time and must not invent a built-in source name

Where a reference Playbook still requires a filesystem copy, show the exact repository path and describe the file as inert until explicit activation

- [ ] **Step 5: Add generated status tables**

Generate the command and integration status tables from `generated/product-surface.json` rather than maintaining duplicate manual lists

- [ ] **Step 6: Verify docs and distribution**

Run

```bash
bun test tests/docs/onboarding-smoke.test.ts
bun run validate:public-claims
bun run validate:distribution
```

Expected result: all public commands parse and every sensitive claim resolves to evidence

- [ ] **Step 7: Commit**

```bash
git add README.md docs/getting-started/onboarding.md docs/launch tests/docs/onboarding-smoke.test.ts generated/product-surface.json
git commit -m "docs: align positioning with executable behavior"
```

### Task 4: Repair the verify contract before using verification language

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli/handlers/verify.ts`
- Modify: `src/cli/command-registry.ts`
- Create: `tests/cli/verify-command.test.ts`
- Modify: `tests/cli/product-flow.test.ts`

**Interfaces:**
- Produces: `handleVerifyCommand(root: string): Promise<VerifyResult>`
- `VerifyResult` includes configured gates, executed commands, evidence references, status, and qualified limitations

- [ ] **Step 1: Write the negative control**

Create a fixture with an active Playbook that declares a failing verification command

Assert that `dokion verify` executes the command, records evidence, exits non-zero, and does not return success from schema validation alone

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/cli/verify-command.test.ts`

Expected result: the existing `verify` branch validates contracts and does not execute the declared gate

- [ ] **Step 3: Route verify through the production verification path**

Implement `handleVerifyCommand` using the same verification evaluator used after execution

Keep it write-free for repository source files while allowing Dokion-owned evidence and report updates declared by the runtime contract

- [ ] **Step 4: Return exact evidence**

Include each command, exit code, duration, bounded output artifact, and final gate state

Do not mark the repository ready when any required gate is missing, skipped, or unproven

- [ ] **Step 5: Run focused and full checks**

Run

```bash
bun test tests/cli/verify-command.test.ts tests/cli/product-flow.test.ts
bun test
bun run typecheck
bun run build
```

Expected result: the negative control fails closed and passing gates produce recorded evidence

- [ ] **Step 6: Regenerate product surface and docs**

Run

```bash
bun run generate:product-surface
bun run validate:public-claims
```

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/cli/handlers/verify.ts src/cli/command-registry.ts tests/cli/verify-command.test.ts tests/cli/product-flow.test.ts generated/product-surface.json
git commit -m "fix: make verify execute declared gates"
```

### Task 5: Add a release truth gate

**Files:**
- Create: `scripts/validate-release-truth.ts`
- Create: `tests/release/release-truth.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `docs/launch/public-beta-checklist.md`

**Interfaces:**
- Consumes: product surface, package metadata, CLI help snapshot, docs claim annotations, promotion sign-off
- Produces: one release truth report with exact failing sources

- [ ] **Step 1: Write failing tests for drift**

Test command drift, package description drift, README command drift, unsupported integration badges, stale release line, and missing claim evidence

- [ ] **Step 2: Implement the release truth validator**

The validator must compare exact generated artifacts and reject dirty regeneration output

- [ ] **Step 3: Add CI and release gates**

Run the validator after build and before package smoke or publication

- [ ] **Step 4: Update the launch checklist**

Require signed review of the generated truth report for the exact release candidate commit

- [ ] **Step 5: Verify complete repository gates**

Run

```bash
bun run generate:product-surface
bun run validate:release-truth
bun test
bun run typecheck
bun run build
bun run validate:distribution
bun run smoke:package
```

Expected result: all pass with no generated diff

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-release-truth.ts tests/release/release-truth.test.ts .github/workflows/ci.yml .github/workflows/release.yml docs/launch/public-beta-checklist.md package.json
git commit -m "ci: gate releases on truthful product claims"
```

## PR Completion Gate

The PR is complete only when CodeRabbit reports no unresolved critical or major issue, every review thread is resolved, the branch is current with `main`, full CI passes, generated files are clean, and the PR body lists removed or downgraded claims with their evidence source
