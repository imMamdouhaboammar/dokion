# Task 11: Stale Run Classifier (`CORE-011`)

## Overview
Implement `src/autopilot/stale-run.ts` to detect commit drift, identity changes, playbook SHA-256 changes, or capability lock differences before resuming runs.

## Target Files
- `src/autopilot/stale-run.ts`
- `tests/autopilot/stale-run.test.ts`

## Scope Boundaries
- Return typed review decision when material state or context changes occur.
- Prevent blind continuation when context is stale.

## Instructions & Verification
1. Create `tests/autopilot/stale-run.test.ts`.
2. Verify test fails: `bun test tests/autopilot/stale-run.test.ts`.
3. Implement `src/autopilot/stale-run.ts`.
4. Run `bun test tests/autopilot/stale-run.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
