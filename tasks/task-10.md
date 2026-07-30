# Task 10: Re-run Verification Gates (`CORE-010`)

## Overview
Implement `src/verification/verify-run.ts` and update `src/cli/handlers/verify.ts` to re-run configured verification gates in read-only mode against current repo identity.

## Target Files
- `src/verification/verify-run.ts`
- `src/cli/handlers/verify.ts`
- `tests/cli/verify.test.ts`

## Scope Boundaries
- Read-only execution of declared step verification commands.
- Store fresh evidence without executing repairs or state mutations.

## Instructions & Verification
1. Create `tests/cli/verify.test.ts`.
2. Verify test fails: `bun test tests/cli/verify.test.ts`.
3. Implement `src/verification/verify-run.ts` and update `src/cli/handlers/verify.ts`.
4. Run `bun test tests/cli/verify.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
