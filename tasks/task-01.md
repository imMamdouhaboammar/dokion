# Task 01: Core Next-Action Selector (`CORE-001`)

## Overview
Implement `src/autopilot/next-action.ts` and `src/autopilot/types.ts` to provide deterministic next-action selection for Dokion given the current runtime state and active playbook.

## Target Files
- `src/autopilot/types.ts`
- `src/autopilot/next-action.ts`
- `tests/autopilot/next-action.test.ts`

## Scope Boundaries
- Do NOT modify existing state schemas unless required.
- Do NOT implement approval policy logic here (reserved for Task 02).
- Return a typed decision result: `{ status: 'ACTION_SELECTED' | 'STOP_REASON', action?: ActionSpec, reason?: string }`.

## Instructions & Verification
1. Create `tests/autopilot/next-action.test.ts` with unit tests for state-to-action selection.
2. Verify test fails using `bun test tests/autopilot/next-action.test.ts`.
3. Implement `src/autopilot/types.ts` and `src/autopilot/next-action.ts`.
4. Run `bun test tests/autopilot/next-action.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
