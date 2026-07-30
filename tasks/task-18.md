# Task 18: Capability Audit in Doctor (`CAP-008`)

## Overview
Update `src/inspect/doctor.ts` and `src/cli/handlers/doctor.ts` to include capability locks, missing executables, digest verification, and capability conflict detection in `dokion doctor`.

## Target Files
- `src/inspect/doctor.ts`
- `src/cli/handlers/doctor.ts`
- `tests/cli/doctor.test.ts`

## Scope Boundaries
- Must render diagnostic health checks for capabilities without mutating state.

## Instructions & Verification
1. Create or update `tests/cli/doctor.test.ts`.
2. Verify test fails: `bun test tests/cli/doctor.test.ts`.
3. Update `src/inspect/doctor.ts` and `src/cli/handlers/doctor.ts`.
4. Run `bun test tests/cli/doctor.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
