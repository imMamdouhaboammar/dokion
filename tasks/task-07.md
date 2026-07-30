# Task 07: Dry-Run Decision Tracer (`CORE-007`)

## Overview
Implement `src/autopilot/trace.ts` to support `dokion autopilot --dry-run` with machine-readable decision traces.

## Target Files
- `src/autopilot/trace.ts`
- `tests/autopilot/dry-run.test.ts`

## Scope Boundaries
- Must NOT execute side effects, modify state, or alter workspace files.
- Must render predicted state transitions and stop reasons deterministically.

## Instructions & Verification
1. Create `tests/autopilot/dry-run.test.ts`.
2. Verify test fails: `bun test tests/autopilot/dry-run.test.ts`.
3. Implement `src/autopilot/trace.ts`.
4. Run `bun test tests/autopilot/dry-run.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
