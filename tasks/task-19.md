# Task 19: Isolated Argument-Vector Command Runner (`EXEC-001`, `EXEC-002`)

## Overview
Implement `src/execution/command-runner.ts` using `Bun.spawn` to execute commands as explicit argument vectors in stripped environment contexts.

## Target Files
- `src/execution/command-runner.ts`
- `tests/execution/command-runner.test.ts`

## Scope Boundaries
- Must NOT use shell expansion (`sh -c`) when argument vectors are provided.
- Environment variables must be stripped of private credentials unless explicitly passed.

## Instructions & Verification
1. Create `tests/execution/command-runner.test.ts`.
2. Verify test fails: `bun test tests/execution/command-runner.test.ts`.
3. Implement `src/execution/command-runner.ts`.
4. Run `bun test tests/execution/command-runner.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
