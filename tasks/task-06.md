# Task 06: Autopilot Command Handler & Engine (`CORE-006`)

## Overview
Implement `src/cli/handlers/autopilot.ts` and `src/autopilot/run-autopilot.ts` for the `dokion autopilot` command.

## Target Files
- `src/cli/handlers/autopilot.ts`
- `src/autopilot/run-autopilot.ts`
- `tests/autopilot/command.test.ts`

## Scope Boundaries
- Integrates next-action, approval policy, failure policy, retry policy, and budget checks.
- Runs only when exclusive lock and active playbook are valid.

## Instructions & Verification
1. Create `tests/autopilot/command.test.ts`.
2. Verify test fails: `bun test tests/autopilot/command.test.ts`.
3. Implement `src/autopilot/run-autopilot.ts` and `src/cli/handlers/autopilot.ts`.
4. Run `bun test tests/autopilot/command.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
