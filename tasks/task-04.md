# Task 04: Bounded Retry Scheduler (`CORE-004`)

## Overview
Implement `src/autopilot/retry-policy.ts` to manage attempt counters, retry eligibility, delay calculations, and maximum iteration bounds.

## Target Files
- `src/autopilot/retry-policy.ts`
- `tests/autopilot/retry-policy.test.ts`

## Scope Boundaries
- Retry only for declared retryable step errors.
- Never alter selected action or capability during retries.

## Instructions & Verification
1. Create `tests/autopilot/retry-policy.test.ts`.
2. Verify test fails: `bun test tests/autopilot/retry-policy.test.ts`.
3. Implement `src/autopilot/retry-policy.ts`.
4. Run `bun test tests/autopilot/retry-policy.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
