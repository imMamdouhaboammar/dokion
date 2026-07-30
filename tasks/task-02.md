# Task 02: Centralized Approval Policy Evaluator (`CORE-002`)

## Overview
Implement `src/policy/approval-policy.ts` to centralize evaluation for all approval policy enums (`NEVER`, `FROM_PLAYBOOK`, `BEFORE_EXECUTION`, `BEFORE_WRITE`, `BEFORE_EACH_FIX`, `BEFORE_COMMIT`, `ALWAYS`).

## Target Files
- `src/policy/approval-policy.ts`
- `tests/autopilot/approval-boundary.test.ts`

## Scope Boundaries
- Must support all approval enums defined in playbook schemas.
- Must reject stale or invalid approvals with explicit error codes.

## Instructions & Verification
1. Create `tests/autopilot/approval-boundary.test.ts` testing approval policy evaluation across contexts.
2. Verify test fails: `bun test tests/autopilot/approval-boundary.test.ts`.
3. Implement `src/policy/approval-policy.ts`.
4. Run `bun test tests/autopilot/approval-boundary.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
