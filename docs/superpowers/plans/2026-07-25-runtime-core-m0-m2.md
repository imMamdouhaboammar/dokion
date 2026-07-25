# Dokion Runtime Core M0-M2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Dokion specification into a runnable Bun CLI that validates the catalog and playbook, pins the active playbook digest, persists resumable state, executes declared shell verification steps in exact order, stores evidence, and renders `HARDENING.md`.

**Architecture:** The CLI is a thin command router over isolated modules for schema validation, immutable playbook loading, atomic state persistence, append-only events, evidence capture, ordered execution, and report generation. The active playbook remains user-owned and write-protected. M0-M2 intentionally execute only commands explicitly present in the approved playbook; capability-specific plugin invocation is deferred to later milestones.

**Tech Stack:** TypeScript, Bun 1.3.14, Ajv 8.20.0, ajv-formats 3.0.1, Bun test, GitHub Actions.

## Global Constraints

- `.dokion/playbook.json` is never written by Dokion.
- A run records the SHA-256 digest of the active playbook and rechecks it before every step.
- A digest mismatch terminates the run as `TAINTED`.
- Steps execute in the exact stage and step order declared by the playbook.
- `sha256:PLACEHOLDER` makes a playbook structurally valid but non-executable.
- State writes are atomic and events are append-only.
- A step succeeds only when every declared verification command exits with code 0 and evidence is stored.
- No capability is installed, selected, substituted, reordered, or enabled by the runtime.
- Generated files remain under `.dokion/` plus `HARDENING.md`.
- Tests use seeded temporary repositories and must prove red-green behavior.

---

### Task 1: Bun test harness and contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.github/workflows/ci.yml`
- Create: `tests/schema-validation.test.ts`
- Create: `tests/playbook-loader.test.ts`
- Create: `tests/state-store.test.ts`
- Create: `tests/engine.test.ts`

**Interfaces:**
- Produces tests for `validateRepositoryContracts`, `loadActivePlaybook`, `StateStore`, and `ExecutionEngine`.

- [ ] Write failing tests for schema validation, placeholder rejection, digest mutation detection, atomic state persistence, ordered execution, evidence storage, and resume behavior.
- [ ] Run `bun test` and confirm failure is caused by missing runtime modules.
- [ ] Commit the red tests.

### Task 2: Schema validator and immutable playbook loader

**Files:**
- Create: `src/contracts/schema-validator.ts`
- Create: `src/playbook/load-playbook.ts`
- Create: `src/core/errors.ts`
- Create: `src/core/json.ts`
- Create: `src/core/digest.ts`

**Interfaces:**
- Produces `validateRepositoryContracts(root): Promise<ValidationSummary>`.
- Produces `loadActivePlaybook(root): Promise<LoadedPlaybook>`.
- Produces `assertPlaybookUnchanged(loaded): Promise<void>`.

- [ ] Implement JSON loading and canonical SHA-256 hashing.
- [ ] Compile repository schemas with Ajv 2020.
- [ ] Validate `dokion.json`, reference playbooks, and runtime artifacts.
- [ ] Reject active playbooks containing `sha256:PLACEHOLDER`.
- [ ] Recheck the digest before every execution step.
- [ ] Run focused tests and commit.

### Task 3: Atomic state, journal, and evidence store

**Files:**
- Create: `src/state/types.ts`
- Create: `src/state/state-store.ts`
- Create: `src/state/event-log.ts`
- Create: `src/evidence/evidence-store.ts`

**Interfaces:**
- Produces `StateStore.initialize`, `StateStore.load`, and `StateStore.update`.
- Produces `appendEvent(root, event)`.
- Produces `writeCommandEvidence(root, record)`.

- [ ] Implement atomic temp-file plus rename writes.
- [ ] Preserve append-only NDJSON event ordering.
- [ ] Store command stdout, stderr, exit code, timing, stage, step, and commit SHA.
- [ ] Run focused tests and commit.

### Task 4: Ordered execution engine and recovery

**Files:**
- Create: `src/engine/execution-engine.ts`
- Create: `src/engine/command-runner.ts`
- Create: `src/engine/dependencies.ts`

**Interfaces:**
- Produces `ExecutionEngine.run()` and `ExecutionEngine.resume()`.
- Consumes the immutable loaded playbook, StateStore, event log, and evidence store.

- [ ] Flatten sequential stages without changing declared order.
- [ ] Check stage and step dependencies before execution.
- [ ] Recheck playbook digest before every step.
- [ ] Execute only declared `verification` commands for M0-M2.
- [ ] Stop on approval policies that require an external approval record.
- [ ] Persist state before and after each command.
- [ ] Mark failed, blocked, completed, and tainted states accurately.
- [ ] Resume from the first incomplete step without rerunning succeeded steps.
- [ ] Run focused tests and commit.

### Task 5: CLI, inspection, reporting, and CI gate

**Files:**
- Create: `src/cli.ts`
- Create: `src/inspect/project-inspector.ts`
- Create: `src/report/render-hardening.ts`
- Create: `src/index.ts`
- Modify: `README.md`

**Interfaces:**
- Commands: `dokion init`, `inspect`, `validate`, `run`, `resume`, `status`, `report`, `verify`.

- [ ] Implement CLI parsing without hidden activation or installation commands.
- [ ] `init` creates only Dokion-owned state and report files.
- [ ] `inspect` reports Git identity, stack indicators, scripts, and existing CI without selecting capabilities.
- [ ] `validate` validates catalog, schemas, and the active playbook.
- [ ] `run` and `resume` call the execution engine.
- [ ] `status` and `report` read state only.
- [ ] Update README status and usage.
- [ ] Run `bun test`, `bun run typecheck`, `bun run validate:contracts`, and `bun run build`.
- [ ] Open a pull request with exact verification evidence.
