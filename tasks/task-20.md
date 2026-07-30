# Task 20: Process Tree Termination & Output Spooler (`EXEC-004`, `EXEC-005`)

## Overview
Implement `src/execution/spooler.ts` and process tree termination in `src/execution/command-runner.ts` to spool bounded output streams and kill timed-out process trees cleanly.

## Target Files
- `src/execution/spooler.ts`
- `src/execution/command-runner.ts`
- `tests/execution/spooler.test.ts`

## Scope Boundaries
- Must enforce maximum byte bounds on stdout/stderr spooling.
- Must send SIGTERM then SIGKILL to entire child process group on timeout.

## Instructions & Verification
1. Create `tests/execution/spooler.test.ts`.
2. Verify test fails: `bun test tests/execution/spooler.test.ts`.
3. Implement `src/execution/spooler.ts` and update `src/execution/command-runner.ts`.
4. Run `bun test tests/execution/spooler.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
