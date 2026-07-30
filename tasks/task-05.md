# Task 05: Run Budget Evaluator (`CORE-005`)

## Overview
Implement `src/autopilot/run-budget.ts` to enforce playbook budgets for wall-clock time, command executions, retries, repairs, findings, evidence bytes, and modified lines.

## Target Files
- `src/autopilot/run-budget.ts`
- `tests/autopilot/run-budget.test.ts`

## Scope Boundaries
- Return exact stable stop reasons when any budget threshold is exceeded.
- Support budget tracking across multiple runs and resumes.

## Instructions & Verification
1. Create `tests/autopilot/run-budget.test.ts`.
2. Verify test fails: `bun test tests/autopilot/run-budget.test.ts`.
3. Implement `src/autopilot/run-budget.ts`.
4. Run `bun test tests/autopilot/run-budget.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
