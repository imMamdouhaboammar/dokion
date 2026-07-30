# Task 09: Auditable Skip Decision Store (`CORE-009`)

## Overview
Implement `src/approvals/skip-store.ts` and `src/cli/handlers/skip.ts` for recording step skips with actor, rationale, and append-only event journal records.

## Target Files
- `src/approvals/skip-store.ts`
- `src/cli/handlers/skip.ts`
- `tests/cli/skip.test.ts`

## Scope Boundaries
- Block skips for required steps.
- Journal skip decisions in `.dokion/events.ndjson`.

## Instructions & Verification
1. Create `tests/cli/skip.test.ts`.
2. Verify test fails: `bun test tests/cli/skip.test.ts`.
3. Implement `src/approvals/skip-store.ts` and `src/cli/handlers/skip.ts`.
4. Run `bun test tests/cli/skip.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
