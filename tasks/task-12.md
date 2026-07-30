# Task 12: Bounded Autopilot End-to-End Acceptance (`CORE-012`)

## Overview
Implement an end-to-end integration test fixture in `tests/fixtures/autopilot-project/` and `tests/autopilot/bounded-autopilot.e2e.test.ts`.

## Target Files
- `tests/fixtures/autopilot-project/dokion.json`
- `tests/fixtures/autopilot-project/.dokion/playbook.json`
- `tests/autopilot/bounded-autopilot.e2e.test.ts`

## Scope Boundaries
- Must test full lifecycle: analysis -> pause -> approval -> repair -> rejection of bad repair -> resume -> verify -> audit -> completion.

## Instructions & Verification
1. Create fixture files in `tests/fixtures/autopilot-project/`.
2. Create `tests/autopilot/bounded-autopilot.e2e.test.ts`.
3. Run `bun test tests/autopilot/bounded-autopilot.e2e.test.ts` and ensure 100% pass.
4. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
