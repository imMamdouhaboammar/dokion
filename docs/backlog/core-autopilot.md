# Dokion Core Runtime and Bounded Autopilot Backlog

## Scope

Turn the current ordered runtime into a deterministic bounded autopilot. Every action must be derived from the active playbook, validated state, capability lock, approvals, policies, and budgets.

P0 blocks public-beta promotion. P1 blocks a broader production-grade claim unless the surface is explicitly excluded.

## Backlog

### CORE-001 Build deterministic next-action selection

- Priority: P0
- Depends on: STATE-002, STATE-003
- Primary files: `src/autopilot/next-action.ts`, `src/autopilot/types.ts`
- Verification: `tests/autopilot/next-action.test.ts`
- Deliverable: A typed decision engine that selects exactly one declared action or returns a stable stop reason.
- Acceptance: Identical validated state produces identical output. Ambiguous, dependency-blocked, inapplicable, stale, or terminal states never execute work.

### CORE-002 Centralize approval boundary evaluation

- Priority: P0
- Depends on: CORE-001
- Primary files: `src/policy/approval-policy.ts`, `src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/approval-boundary.test.ts`
- Deliverable: One evaluator for every approval enum across run, resume, step, repair, activation, and commit-capable paths.
- Acceptance: Stale, rejected, expired, wrong-run, and wrong-scope approvals fail closed. No command path can bypass an approval boundary.

### CORE-003 Complete failure policy transitions

- Priority: P0
- Depends on: CORE-001
- Primary files: `src/policy/failure-policy.ts`, `src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/failure-policy.test.ts`
- Deliverable: Typed outcomes for `STOP_PIPELINE`, `STOP_STAGE`, `CONTINUE`, `REQUEST_USER_DECISION`, and `MARK_BLOCKED`.
- Acceptance: Every policy produces distinct run, stage, step, and event transitions with no generic failure fallback.

### CORE-004 Add bounded retry scheduling

- Priority: P0
- Depends on: CORE-003, STATE-009
- Primary files: `src/autopilot/retry-policy.ts`, `src/state/types.ts`
- Verification: `tests/autopilot/retry-policy.test.ts`
- Deliverable: Retry eligibility, counters, delays, maximum iterations, journal records, and exhaustion handling.
- Acceptance: Retries never exceed declared count, iteration, time, or run budgets and never substitute another command or capability.

### CORE-005 Enforce run budgets

- Priority: P0
- Depends on: STATE-002, STATE-009
- Primary files: `src/autopilot/run-budget.ts`, `schemas/dokion-playbook.schema.json`
- Verification: `tests/autopilot/run-budget.test.ts`
- Deliverable: Limits for wall time, commands, retries, repairs, findings, evidence bytes, and changed lines.
- Acceptance: Each exhausted budget blocks the next side effect with a precise reason and persists consumed and remaining counters.

### CORE-006 Implement the autopilot command

- Priority: P0
- Depends on: CORE-001, CORE-002, CORE-003, CORE-004, CORE-005, CAP-008, STATE-001
- Primary files: `src/cli/handlers/autopilot.ts`, `src/autopilot/run-autopilot.ts`
- Verification: `tests/autopilot/command.test.ts`
- Deliverable: `dokion autopilot` starts or resumes only an active validated playbook after lock, identity, capability, and journal checks.
- Acceptance: It continues deterministic actions until completion or a mandatory stop and refuses proposed playbooks, stale state, invalid locks, or missing evidence.

### CORE-007 Add dry-run decision traces

- Priority: P0
- Depends on: CORE-001, CORE-006
- Primary files: `src/autopilot/trace.ts`, `src/cli/handlers/autopilot.ts`
- Verification: `tests/autopilot/dry-run.test.ts`
- Deliverable: A trace of each predicted state transition, selected action, policy input, and stop reason.
- Acceptance: `dokion autopilot --dry-run` is deterministic and leaves the active playbook, state, evidence, reports, and project source unchanged.

### CORE-008 Implement guarded single-step execution

- Priority: P0
- Depends on: CORE-001, CORE-002, STATE-001
- Primary files: `src/engine/step-executor.ts`, `src/cli/handlers/step.ts`
- Verification: `tests/cli/step.test.ts`
- Deliverable: `dokion step <step-id>` through the same decision and policy engine used by autopilot.
- Acceptance: Only a declared, dependency-satisfied, applicable step can run. Approvals, budgets, permissions, locks, and evidence rules remain enforced.

### CORE-009 Implement auditable skip decisions

- Priority: P0
- Depends on: CORE-002, STATE-003
- Primary files: `src/approvals/skip-store.ts`, `src/cli/handlers/skip.ts`
- Verification: `tests/cli/skip.test.ts`
- Deliverable: Explicit skips for optional steps with actor, reason, timestamp, run scope, and append-only evidence.
- Acceptance: Required steps cannot be skipped, resume consumes the decision, and reports retain actor and rationale.

### CORE-010 Make verify re-run configured gates

- Priority: P0
- Depends on: EVID-008, STATE-001
- Primary files: `src/verification/verify-run.ts`, `src/cli/handlers/verify.ts`
- Verification: `tests/cli/verify.test.ts`
- Deliverable: Read-only execution of declared verification and release gates against current repository identity.
- Acceptance: Fresh evidence is stored, repairs never run, and blocking failures remain visible.

### CORE-011 Classify stale runs before resume

- Priority: P0
- Depends on: STATE-004, STATE-006, CAP-001
- Primary files: `src/autopilot/stale-run.ts`, `src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/stale-run.test.ts`
- Deliverable: Compare commit, repository identity, playbook digest, capability lock, evidence integrity, approvals, and platform guarantees.
- Acceptance: Every material change produces a typed review decision. Blind continuation is impossible.

### CORE-012 Prove bounded autopilot end to end

- Priority: P0
- Depends on: CORE-006, CORE-011, PLAY-010, EXEC-009, EVID-010
- Primary files: `tests/fixtures/autopilot-project/**`
- Verification: `tests/autopilot/bounded-autopilot.e2e.test.ts`
- Deliverable: A seeded fixture that analyzes, pauses, approves, repairs, rejects a fake fix, resumes, verifies, audits, and completes.
- Acceptance: The fixture rejects undeclared actions and substitutions, remains bounded under failure, and reconciles all evidence repeatedly from a clean checkout.
