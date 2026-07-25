# Dokion M3 Capability Findings and Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and test-driven-development task by task.

**Goal:** Execute one declared shell capability end-to-end: emit findings, normalize them, pause for approval when configured, remediate each approved finding, reject suppression-based repairs, verify the result, persist BEFORE/AFTER evidence, and resume without losing state.

**Architecture:** Extend a playbook step with an explicit user-authored `runner` protocol. Dokion supplies only scoped environment variables and executes exact commands already present in `permissions.shell`. Analysis commands write a versioned finding payload to `DOKION_OUTPUT`. Remediation commands receive `DOKION_FINDING_FILE`. The engine remains incapable of choosing or installing capabilities.

**Tech Stack:** Bun, TypeScript, JSON Schema, Git, Bun test.

## Task 1: Protocol and schema

- Add `runner` to the playbook step schema with `kind: shell`, `analyze_command`, `remediate_command`, `finding_sources`, and `output_format: DOKION_FINDINGS_V1`.
- Extend runtime types without weakening existing authority constants.
- Add negative schema tests for undeclared runner commands.

## Task 2: Finding normalization and storage

- Add a versioned raw finding protocol.
- Normalize without changing severity, title, description, rule id, or location.
- Generate stable `DK-<LANE>-NNN` identifiers per run.
- Preserve raw output as BEFORE evidence.
- Validate every normalized finding before persistence.

## Task 3: Approval records

- Add `dokion approve <subject> --by <identity> [--notes <text>]` and `dokion reject`.
- Treat approval records as append-only state.
- Support `step:<id>` and `finding:<id>` subjects.
- Resume from `AWAITING_USER` after a matching approval.

## Task 4: Remediation and adversarial validation

- Execute remediation only in FIX modes and only for findings declared by `finding_sources`.
- Capture Git diff BEFORE and AFTER.
- Detect new suppression directives, deleted tests, and out-of-scope edits.
- Mark invalid repairs `REPAIR_REJECTED`; never `VERIFIED`.
- Run exact verification commands and attach AFTER evidence.

## Task 5: Seeded end-to-end fixture

- Add a fixture project with an unsafe query builder.
- Add a declared analyzer script that emits one finding.
- Add a declared remediation script that repairs it.
- Assert analyze, approval pause, approval record, resume, repair, verification, and final report.
- Add a second remediation that inserts a suppression marker and assert rejection.

## Acceptance

- Existing M0-M2 tests remain green.
- A declared M3 fixture completes with one VERIFIED finding and BEFORE/AFTER evidence.
- A fake suppression repair reaches REPAIR_REJECTED and blocks the run.
- No undeclared command, capability, or finding source executes.
- `bun test`, `bun run typecheck`, `bun run validate:contracts`, and `bun run build` pass in CI.
