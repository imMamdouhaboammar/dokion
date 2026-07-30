# Task 22: Qualification Evaluator & Readiness Report (`EVID-001`, `EVID-002`)

## Overview
Implement `src/evidence/readiness.ts` to evaluate readiness criteria and emit centralized qualification reports.

## Target Files
- `src/evidence/readiness.ts`
- `tests/evidence/readiness.test.ts`

## Scope Boundaries
- Must evaluate all completion criteria against state, evidence, findings, and platform degradations.

## Instructions & Verification
1. Create `tests/evidence/readiness.test.ts`.
2. Verify test fails: `bun test tests/evidence/readiness.test.ts`.
3. Implement `src/evidence/readiness.ts`.
4. Run `bun test tests/evidence/readiness.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
