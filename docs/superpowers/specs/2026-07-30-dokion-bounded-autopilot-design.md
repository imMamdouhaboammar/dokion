# Dokion Bounded Autopilot & Hardening Engine Specification

**Date:** 2026-07-30
**Status:** Approved
**Target Baseline:** Dokion 0.3.0 (Post-M6)
**Target Surface:** Bounded Autopilot, Playbook Registry, Capability Locks, Secure Execution, and Evidence Reporting.

---

## 1. Executive Summary

Dokion is a user-directed software hardening runtime for AI coding agents (Claude Code, Codex, Gemini CLI) and local shell environments. Following the completion of state integrity milestones (`STATE-001` through `STATE-007`), Dokion must transition from an ordered runtime engine into a deterministic, crash-safe **Bounded Autopilot**.

The Bounded Autopilot ensures that every automated action, state transition, repair attempt, and verification gate is strictly governed by user-authored playbooks (`.dokion/playbook.json`), explicit approval boundaries, immutable capability locks, and enforced execution budgets.

---

## 2. Architecture & Subsystems

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              dokion CLI / API                               │
└──────┬──────────────────────────────────┬─────────────────────────────┬─────┘
       │                                  │                             │
┌──────▼──────────────┐         ┌─────────▼───────────┐       ┌─────────▼───────────┐
│ Bounded Autopilot   │         │ Capability Lock     │       │ Playbook Registry   │
│ Engine              │         │ & Provenance        │       │ & Activation        │
│                     │         │                     │       │                     │
│ - Next Action Select│         │ - Lock file manager │       │ - Built-in catalog  │
│ - Approval Policy   │         │ - Executable trace  │       │ - Custom proposal   │
│ - Failure Policy    │         │ - Digest validation │       │ - Activation rules  │
│ - Retry Scheduling  │         │ - Environment check │       │                     │
│ - Wall/Byte Budget  │         │                     │       │                     │
└──────┬──────────────┘         └─────────┬───────────┘       └─────────┬───────────┘
       │                                  │                             │
┌──────▼──────────────────────────────────▼─────────────────────────────▼─────┐
│                          State & Execution Layer                            │
│                                                                             │
│ - Exclusive Run Lock (`STATE-001`)                                          │
│ - Monotonic CAS Revisions (`STATE-002`)                                     │
│ - Event Journal Hash Chain (`STATE-004`)                                    │
│ - Dirty Worktree & Snapshot Policy (`STATE-007`)                            │
│ - Isolated Process Runner & Scope Guard (`EXEC-001`, `EXEC-006`)            │
└──────┬──────────────────────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────────────────┐
│                        Evidence, Audit & Export                             │
│                                                                             │
│ - SHA-256 Evidence Manifests (`EVID-008`)                                  │
│ - SARIF v2.1 Export (`EVID-006`)                                            │
│ - JUnit Test Export (`EVID-007`)                                            │
│ - Qualification & Audit CLI (`EVID-010`)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Workstreams & Technical Requirements

### Workstream 1: Bounded Autopilot Engine (`CORE-001` to `CORE-012`)
1. **Deterministic Action Selection (`CORE-001`)**: `src/autopilot/next-action.ts` selects exactly one action or returns a stable stop reason given the current state and playbook.
2. **Approval Boundary Evaluator (`CORE-002`)**: `src/policy/approval-policy.ts` evaluates all approval enums (`NEVER`, `FROM_PLAYBOOK`, `BEFORE_EXECUTION`, `BEFORE_WRITE`, `BEFORE_EACH_FIX`, `BEFORE_COMMIT`, `ALWAYS`) across CLI commands.
3. **Failure Policy Handler (`CORE-003`)**: `src/policy/failure-policy.ts` handles failure transitions (`STOP_PIPELINE`, `STOP_STAGE`, `CONTINUE`, `REQUEST_USER_DECISION`, `MARK_BLOCKED`).
4. **Retry Scheduler (`CORE-004`)**: `src/autopilot/retry-policy.ts` tracks attempt counts, delay schedules, and maximum retries without altering selected capability.
5. **Run Budget Engine (`CORE-005`)**: `src/autopilot/run-budget.ts` enforces limits for wall time, command executions, retries, repairs, findings, evidence size, and modified lines.
6. **Autopilot Command & Dry-Run (`CORE-006`, `CORE-007`)**: `dokion autopilot` and `dokion autopilot --dry-run` execute or trace transitions deterministically.
7. **Guarded Step Execution & Skips (`CORE-008`, `CORE-009`)**: `dokion step <id>` and `dokion skip <id>` with append-only event records.
8. **Verification Gate Execution (`CORE-010`)**: `dokion verify` re-evaluates all step verification gates against current repository identity without running repairs.
9. **Stale Run Classification (`CORE-011`)**: `src/autopilot/stale-run.ts` detects drift in commits, playbooks, capability locks, or platform capabilities before resuming.

### Workstream 2: Playbook Registry & Library (`PLAY-001` to `PLAY-012`)
1. **Built-in Playbook Registry (`PLAY-001`, `PLAY-002`)**: `src/playbook/registry.ts` loads shipped playbooks (`web-fullstack`, `api-service`, `library-package`).
2. **Playbook Inspection & Proposal (`PLAY-003`, `PLAY-004`)**: `dokion playbook list`, `dokion playbook inspect`, `dokion playbook propose`.
3. **Explicit Activation Boundary (`PLAY-005`, `PLAY-006`)**: `dokion playbook activate` copies proposal to `.dokion/playbook.json` with user confirmation and immutable SHA-256 hashing.

### Workstream 3: Capability Provenance & Security (`CAP-001` to `CAP-008`)
1. **Capability Lock Engine (`CAP-001`, `CAP-002`, `CAP-003`, `CAP-004`)**: `.dokion/capability-lock.json` pins executable paths, semver bounds, SHA-256 binary digests, and Git commit SHAs.
2. **Capability Audit (`CAP-008`)**: `dokion doctor` checks capability prerequisites, missing executables, digest mismatches, and conflicts.

### Workstream 4: Secure Command & Scope Execution (`EXEC-001` to `EXEC-010`)
1. **Process Isolation (`EXEC-001`, `EXEC-002`, `EXEC-003`, `EXEC-005`)**: Isolated argument-vector execution with stripped environment variables, subprocess tree termination, and output spooling.
2. **Scope Guard & Snapshot Repair (`EXEC-006`, `EXEC-007`, `EXEC-009`)**: Pre-repair snapshot, diff boundaries, file write scope restrictions, and atomic rollback on repair failure.

### Workstream 5: Evidence, Audit & Reporting (`EVID-001` to `EVID-012`)
1. **Readiness Evaluation & Qualified Reporting (`EVID-001`, `EVID-002`, `EVID-003`, `EVID-005`)**: Structured JSON reports and `HARDENING.md` updates.
2. **SARIF & JUnit Export (`EVID-006`, `EVID-007`)**: Standardized security findings export (`sarif.json`) and test verification output (`junit.xml`).
3. **Evidence Manifests & Independent Audit (`EVID-008`, `EVID-010`, `EVID-012`)**: SHA-256 evidence tree manifest, `dokion audit`, and promotion sign-off generator.

---

## 4. Verification & QA Standards

- **Unit & Integration Tests**: All new logic must be accompanied by comprehensive tests in `tests/`.
- **Zero Regression**: Existing 152 tests across 34 test files must pass cleanly.
- **Type Safety**: `bun run typecheck` (`tsc --noEmit`) must succeed with zero errors.
- **Contract Conformance**: `bun run validate:contracts` must pass.
- **Distribution Integrity**: `bun run validate:distribution` and `bun run smoke:package` must pass.

---

## 5. Success Criteria

1. 100% test passing rate across Bun test suite.
2. All 12 core autopilot tasks (`CORE-001` to `CORE-012`), 5 key playbook tasks (`PLAY-001` to `PLAY-005`), 4 capability tasks (`CAP-001` to `CAP-004`), 4 execution tasks (`EXEC-001` to `EXEC-004`), and 5 evidence tasks (`EVID-001` to `EVID-005`) fully implemented with tests.
3. Clean Git status upon completion.
