# Task 03: Failure Policy Transition Engine (`CORE-003`)

## Overview
Implement `src/policy/failure-policy.ts` to handle failure policy transitions (`STOP_PIPELINE`, `STOP_STAGE`, `CONTINUE`, `REQUEST_USER_DECISION`, `MARK_BLOCKED`).

## Target Files
- `src/policy/failure-policy.ts`
- `tests/autopilot/failure-policy.test.ts`

## Scope Boundaries
- Must produce deterministic state and event transitions for each failure policy.
- Must preserve error context and diagnostic logs.

## Instructions & Verification
1. Create `tests/autopilot/failure-policy.test.ts`.
2. Verify test fails: `bun test tests/autopilot/failure-policy.test.ts`.
3. Implement `src/policy/failure-policy.ts`.
4. Run `bun test tests/autopilot/failure-policy.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
