# Task 08: Guarded Step Execution CLI (`CORE-008`)

## Overview
Implement `src/engine/step-executor.ts` and `src/cli/handlers/step.ts` to enable single-step execution through `dokion step <step-id>`.

## Target Files
- `src/engine/step-executor.ts`
- `src/cli/handlers/step.ts`
- `tests/cli/step.test.ts`

## Scope Boundaries
- Executes only declared, dependency-satisfied steps.
- Respects approval boundaries, run budgets, and run locks.

## Instructions & Verification
1. Create `tests/cli/step.test.ts`.
2. Verify test fails: `bun test tests/cli/step.test.ts`.
3. Implement `src/engine/step-executor.ts` and `src/cli/handlers/step.ts`.
4. Run `bun test tests/cli/step.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
