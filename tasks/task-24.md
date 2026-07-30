# Task 24: JUnit Test Verification Exporter (`EVID-007`)

## Overview
Implement `src/report/junit.ts` to export step execution and verification evidence as standard JUnit XML reports.

## Target Files
- `src/report/junit.ts`
- `tests/report/junit.test.ts`

## Scope Boundaries
- Output valid XML adhering to standard JUnit testsuite format for CI report integration.

## Instructions & Verification
1. Create `tests/report/junit.test.ts`.
2. Verify test fails: `bun test tests/report/junit.test.ts`.
3. Implement `src/report/junit.ts`.
4. Run `bun test tests/report/junit.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
