# Task 14: Playbook List & Inspect CLI Commands (`PLAY-003`)

## Overview
Implement `src/cli/handlers/playbook.ts` for `dokion playbook list` and `dokion playbook inspect <id>`.

## Target Files
- `src/cli/handlers/playbook.ts`
- `tests/cli/playbook.test.ts`

## Scope Boundaries
- Read-only inspection of available playbooks.
- Support JSON and human-readable output formats.

## Instructions & Verification
1. Create `tests/cli/playbook.test.ts`.
2. Verify test fails: `bun test tests/cli/playbook.test.ts`.
3. Implement `src/cli/handlers/playbook.ts`.
4. Run `bun test tests/cli/playbook.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
