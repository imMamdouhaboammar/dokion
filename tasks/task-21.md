# Task 21: Scope Guard & Pre-Repair Snapshot (`EXEC-006`, `EXEC-007`)

## Overview
Implement `src/validation/scope-guard.ts` to restrict write scopes during repairs and enforce atomic repair snapshot boundaries.

## Target Files
- `src/validation/scope-guard.ts`
- `src/validation/repair-validator.ts`
- `tests/validation/scope-guard.test.ts`

## Scope Boundaries
- Reject repairs modifying files outside declared write scopes.
- Reject repairs adding forbidden suppression directives or deleting tests without declaration.

## Instructions & Verification
1. Create `tests/validation/scope-guard.test.ts`.
2. Verify test fails: `bun test tests/validation/scope-guard.test.ts`.
3. Implement `src/validation/scope-guard.ts` and update `src/validation/repair-validator.ts`.
4. Run `bun test tests/validation/scope-guard.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
