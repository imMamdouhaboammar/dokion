# Dokion 100% Production Enterprise-Grade Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Every behavior change follows RED -> GREEN -> REFACTOR.

**Goal:** Drive Dokion from current baseline to 100% Production Enterprise-Grade Hardening Runtime by completing all remaining assurance modules, evidence generators, adapter contract matrices, promotion gates, and launch checklists.

**Runtime Strictness:** Bun `1.3.14+`, TypeScript `7.0.2`. Zero untrusted runtime dependencies. `.dokion/playbook.json` remains sole execution authority.

---

## Global Verification Commands

- Task Verification: `bun test <test-file> && bun run typecheck`
- Wave Gate Verification:
  - `bun test`
  - `bun run typecheck`
  - `bun run validate:contracts`
  - `bun run validate:distribution`

---

## Execution Waves

### Wave 1: Assurance Modules & Gap Modeling
- **MOD-009**: Implement reliability, performance, and WCAG accessibility assurance modules.
- **MOD-010**: Implement explicit AI agent and mobile coverage gap modeling.

### Wave 2: Run Comparison & Promotion Sign-Off Evidence
- **EVID-009**: Implement deterministic comparison of two Dokion run records (`dokion diff/compare`).
- **EVID-011**: Build evidence retention rules and export bundles.
- **EVID-012**: Implement automated generation of `promotion-signoff.json` backed by cryptographic digests.

### Wave 3: Adapters Parity & Cross-Platform Verification
- **PROD-001..005**: Finalize canonical adapter contract suite for Claude Code, Codex, and Gemini CLI.
- **PROD-006**: Enforce Windows platform compatibility, line endings, and path canonicalization.
- **PROD-007..008**: Implement cross-agent handoff, session resume, and native binary smoke matrices.

### Wave 4: Launch Checklist & Full Audit Sign-Off
- **PROD-009..014**: Complete CLI product flows, onboarding docs, seeded demo repositories, CI release gates, and public launch checklist.
- **PG-001..PG-012**: Execute and verify all 12 Promotion Gates against clean test fixtures.

---

## Detailed Task Breakdown

### Wave 1: Assurance Modules & Gap Modeling

#### Task W1-1: MOD-009 Reliability, Performance, and Accessibility Modules
- **Files:** `modules/observability-reliability/**`, `modules/performance-accessibility/**`, `src/modules/adapters/reliability-performance.ts`
- **Test:** `tests/modules/reliability-performance-accessibility.test.ts`
- **TDD:**
  1. RED: Write failing test checking logging, health checks, timeout/retry/idempotency rules, Core Web Vitals, and WCAG accessibility assertions.
  2. GREEN: Implement typed module adapters with playbook-declared threshold evaluation.
  3. REFACTOR: Ensure pristine test run and zero type errors.

#### Task W1-2: MOD-010 AI & Mobile Coverage Gap Modeling
- **Files:** `modules/coverage-declarations/**`, `src/readiness/coverage.ts`
- **Test:** `tests/modules/coverage-declarations.test.ts`
- **TDD:**
  1. RED: Write failing test checking that AI safety and mobile security lanes show unassigned gap warnings and enforce readiness score caps.
  2. GREEN: Implement explicit gap declaration models and update coverage evaluator.
  3. REFACTOR: Verify no implicit pass is awarded to unassigned security/coverage lanes.

---

### Wave 2: Run Comparison & Promotion Sign-Off Evidence

#### Task W2-1: EVID-009 Compare Two Dokion Runs (`dokion compare`/`diff`)
- **Files:** `src/report/compare-runs.ts`, `src/cli/handlers/compare.ts`, `src/cli/command-registry.ts`
- **Test:** `tests/report/compare-runs.test.ts`
- **TDD:**
  1. RED: Write failing test comparing two run states and asserting exact diff output for findings, gates, coverage, playbooks, locks, and platforms.
  2. GREEN: Implement read-only comparison engine and CLI handler.
  3. REFACTOR: Ensure comparison never mutates or rewrites run state.

#### Task W2-2: EVID-011 Evidence Retention & Export Bundles
- **Files:** `src/evidence/retention.ts`, `src/export/run-bundle.ts`
- **Test:** `tests/evidence/retention-export.test.ts`
- **TDD:**
  1. RED: Write failing test checking retention class rules, safe pruning, portable ZIP/tar bundle export, and bundle verifier.
  2. GREEN: Implement evidence retention manager and bundle packager/verifier without credential leakage.
  3. REFACTOR: Confirm required evidence cannot be pruned.

#### Task W2-3: EVID-012 Automated Promotion Sign-Off Record
- **Files:** `schemas/dokion-promotion-signoff.schema.json`, `src/readiness/promotion-signoff.ts`
- **Test:** `tests/readiness/promotion-signoff.test.ts`
- **TDD:**
  1. RED: Write failing test checking generation of schema-valid `promotion-signoff.json` backed by SHA-256 hashes of all state, evidence, and gate verification results.
  2. GREEN: Implement promotion signoff generator.
  3. REFACTOR: Ensure generator blocks if any mandatory gate fails.

---

### Wave 3: Adapters Parity & Cross-Platform Verification

#### Task W3-1: PROD-001..005 Canonical Adapter Contract Suite
- **Files:** `src/platform/adapter-contract.ts`, `src/platform/guarantees.ts`, `.claude-plugin/**`, `.agents/skills/dokion-hardening/**`, `commands/dokion/**`, `gemini-extension.json`
- **Test:** `tests/adapters/adapter-contract.test.ts`, `tests/adapters/claude.test.ts`, `tests/adapters/codex.test.ts`, `tests/adapters/gemini.test.ts`, `tests/adapters/platform-guarantees.test.ts`
- **TDD:**
  1. RED: Write failing tests verifying identity, command parity, hook safety, and guarantee negotiation across Claude Code, Codex, and Gemini CLI adapters.
  2. GREEN: Implement adapter contract verifiers and guarantee negotiator.
  3. REFACTOR: Confirm no adapter adds permissions or commands outside core CLI.

#### Task W3-2: PROD-006 Windows Platform Compatibility
- **Files:** `src/execution/windows/platform.ts`, `src/execution/windows/path.ts`
- **Test:** `tests/platform/windows.test.ts`
- **TDD:**
  1. RED: Write failing tests for Windows path canonicalization (CRLF, backslashes, drive letters), process tree termination, and case sensitivity rules.
  2. GREEN: Implement Windows execution helper and path policy adaptors.
  3. REFACTOR: Ensure cross-platform path handling passes cleanly on macOS/Linux.

#### Task W3-3: PROD-007..008 Native Smoke & Cross-Agent Resume
- **Files:** `tests/distribution/native-smoke.test.ts`, `tests/adapters/cross-agent-resume.test.ts`
- **Test:** `tests/distribution/native-smoke.test.ts`, `tests/adapters/cross-agent-resume.test.ts`
- **TDD:**
  1. RED: Write failing tests for native package smoke execution and cross-adapter session pause/resume reconciliation.
  2. GREEN: Implement smoke test logic and handoff reconciliation verifier.
  3. REFACTOR: Confirm state continuity and event log integrity during handoff.

---

### Wave 4: Launch Checklist & Full Audit Sign-Off

#### Task W4-1: PROD-009..014 Coherent Product Flows, Docs, Fixtures, CI & Launch Checklist
- **Files:** `docs/getting-started/ONBOARDING.md`, `docs/operations/RECOVERY.md`, `docs/launch/public-beta-checklist.md`, `tests/fixtures/promotion/**`, `.github/workflows/ci.yml`
- **Test:** `tests/cli/product-flow.test.ts`, `tests/docs/onboarding-smoke.test.ts`, `tests/acceptance/promotion-fixtures.test.ts`, `tests/contracts/ci-gates.test.ts`, `tests/release/release-integrity.test.ts`, `tests/contracts/public-beta-checklist.test.ts`
- **TDD:**
  1. RED: Write failing tests validating CLI product flows, onboarding commands, promotion fixtures (web, API, library), CI workflow rules, and launch checklist.
  2. GREEN: Create documentation, promotion fixtures, CI validation tests, and launch checklist.
  3. REFACTOR: Confirm all public beta launch criteria pass.

#### Task W4-2: PG-001..PG-012 Formal Promotion Gates Sign-Off
- **Files:** `src/readiness/release-gates.ts`
- **Test:** `tests/release-gates.test.ts`, `tests/release-gates-runtime.test.ts`
- **TDD:**
  1. RED: Write failing test evaluating all 12 Promotion Gates against clean test fixtures.
  2. GREEN: Verify each gate check returns PASS with evidence digest.
  3. REFACTOR: Run `dokion audit` and confirm 100% green enterprise readiness.
