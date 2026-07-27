# Dokion Core Runtime and Bounded Autopilot Backlog

## Scope

This workstream turns the existing ordered runtime into a deterministic bounded autopilot. Every action remains derived from the active playbook, validated state, capability lock, approvals, policies, and budgets.

## Task format

Each task is a reviewable delivery unit. P0 blocks public-beta promotion. P1 blocks the broader production-grade claim unless the corresponding surface is explicitly excluded.

## Backlog

### CORE-001 Build deterministic next-action selection

- Priority: P0
- Depends on: STATE-002, STATE-003
- Primary files: `src/autopilot/next-action.ts; src/autopilot/types.ts`
- Verification: `tests/autopilot/next-action.test.ts`
- Deliverable: Create `src/autopilot/next-action.ts` with a typed decision result that selects exactly one declared action or a stable stop reason.
- Acceptance: The same validated state produces the same action; ambiguous, dependency-blocked, inapplicable, stale, or terminal states produce tested non-execution decisions.

### CORE-002 Centralize approval boundary evaluation

- Priority: P0
- Depends on: CORE-001
- Primary files: `src/policy/approval-policy.ts; src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/approval-boundary.test.ts`
- Deliverable: Create one policy evaluator for every approval enum and consume it from run, resume, step, repair, commit-capable, and activation paths.
- Acceptance: No command path can bypass `NEVER`, `FROM_PLAYBOOK`, `BEFORE_EXECUTION`, `BEFORE_WRITE`, `BEFORE_EACH_FIX`, `BEFORE_COMMIT`, or `ALWAYS`; stale and wrong-scope approvals fail closed.

### CORE-003 Complete failure policy transitions

- Priority: P0
- Depends on: CORE-001
- Primary files: `src/policy/failure-policy.ts; src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/failure-policy.test.ts`
- Deliverable: Move failure-policy evaluation into a typed module and define state and event outcomes for every declared policy.
- Acceptance: `STOP_PIPELINE`, `STOP_STAGE`, `CONTINUE`, `REQUEST_USER_DECISION`, and `MARK_BLOCKED` produce distinct tested run, stage, step, and event states.

### CORE-004 Add bounded retry scheduling

- Priority: P0
- Depends on: CORE-003, STATE-009
- Primary files: `src/autopilot/retry-policy.ts; src/state/types.ts`
- Verification: `tests/autopilot/retry-policy.test.ts`
- Deliverable: Implement retry eligibility, attempt counters, delay policy, maximum iterations, journal entries, and exhaustion behavior.
- Acceptance: Retries occur only for declared retryable failures, never exceed count, iteration, time, or run budgets, and never change the selected command or capability.

### CORE-005 Enforce run budgets

- Priority: P0
- Depends on: STATE-002, STATE-009
- Primary files: `src/autopilot/run-budget.ts; schemas/dokion-playbook.schema.json`
- Verification: `tests/autopilot/run-budget.test.ts`
- Deliverable: Add playbook limits for wall time, commands, retries, repairs, findings, evidence bytes, and changed lines, then evaluate before each side effect.
- Acceptance: Each exhausted budget returns a precise stable reason, persists remaining counters, blocks the next side effect, and renders in status and reports.

### CORE-006 Implement the autopilot command

- Priority: P0
- Depends on: CORE-001, CORE-002, CORE-003, CORE-004, CORE-005, CAP-008, STATE-001
- Primary files: `src/cli/handlers/autopilot.ts; src/autopilot/run-autopilot.ts`
- Verification: `tests/autopilot/command.test.ts`
- Deliverable: Add `dokion autopilot` that starts or resumes only the active validated playbook after lock, repository, capability, and journal checks.
- Acceptance: The command continues deterministic actions until completion or a mandatory stop and refuses proposed playbooks, invalid locks, stale identity, or missing evidence.

### CORE-007 Add dry-run decision traces

- Priority: P0
- Depends on: CORE-001, CORE-006
- Primary files: `src/autopilot/trace.ts; src/cli/handlers/autopilot.ts`
- Verification: `tests/autopilot/dry-run.test.ts`
- Deliverable: Render each predicted state transition, selected action, policy input, and stop reason without executing commands or writing source files.
- Acceptance: `dokion autopilot --dry-run` is deterministic, machine-readable in JSON mode, and leaves active playbook, state, evidence, reports, and project source unchanged.

### CORE-008 Implement guarded single-step execution

- Priority: P0
- Depends on: CORE-001, CORE-002, STATE-001
- Primary files: `src/engine/step-executor.ts; src/cli/handlers/step.ts`
- Verification: `tests/cli/step.test.ts`
- Deliverable: Add `dokion step <step-id>` through the same decision and policy engine used by autopilot.
- Acceptance: Only a declared, dependency-satisfied, applicable step can run; approvals, budgets, permissions, locks, and evidence rules remain enforced.

### CORE-009 Implement auditable skip decisions

- Priority: P0
- Depends on: CORE-002, STATE-003
- Primary files: `src/approvals/skip-store.ts; src/cli/handlers/skip.ts`
- Verification: `tests/cli/skip.test.ts`
- Deliverable: Allow explicit skips only for optional steps with actor, reason, timestamp, run scope, and append-only event evidence.
- Acceptance: Required steps cannot be skipped, resume consumes the recorded decision, and reports retain the actor and rationale.

### CORE-010 Make verify re-run configured gates

- Priority: P0
- Depends on: EVID-008, STATE-001
- Primary files: `src/verification/verify-run.ts; src/cli/handlers/verify.ts`
- Verification: `tests/cli/verify.test.ts`
- Deliverable: Replace contract-only verify behavior with read-only execution of declared step verification and release gates against the current repository identity.
- Acceptance: Fresh evidence is stored, repairs never run, stale results are replaced only for the current verification attempt, and blocking failures are reported.

### CORE-011 Classify stale runs before resume

- Priority: P0
- Depends on: STATE-004, STATE-006, CAP-001
- Primary files: `src/autopilot/stale-run.ts; src/engine/runtime-engine.ts`
- Verification: `tests/autopilot/stale-run.test.ts`
- Deliverable: Compare commit, repository identity, playbook digest, capability lock, evidence integrity, approvals, and platform guarantees before continuation.
- Acceptance: Each material change produces a typed review decision; blind continuation is impossible and harmless revalidation is permitted only by explicit policy.

### CORE-012 Prove bounded autopilot end to end

- Priority: P0
- Depends on: CORE-006, CORE-011, PLAY-010, EXEC-009, EVID-010
- Primary files: `tests/fixtures/autopilot-project/**`
- Verification: `tests/autopilot/bounded-autopilot.e2e.test.ts`
- Deliverable: Create a seeded fixture that analyzes, pauses, approves, repairs, rejects a fake fix, resumes, verifies, audits, and completes.
- Acceptance: The fixture rejects undeclared actions and substitutions, remains bounded under failures, reconciles all evidence, and passes repeatedly from a clean checkout.
