# Task 15: Playbook Proposal & Activation (`PLAY-004`, `PLAY-005`)

## Overview
Implement playbook proposal generation and explicit activation (`dokion playbook propose <id>`, `dokion playbook activate <file>`) to copy playbooks to `.dokion/playbook.json` with user confirmation and immutable SHA-256 calculation.

## Target Files
- `src/playbook/registry.ts`
- `src/cli/handlers/playbook.ts`
- `tests/playbook/activation.test.ts`

## Scope Boundaries
- Do NOT silently replace existing `.dokion/playbook.json` without explicit user confirmation/flag.
- Calculate and record SHA-256 digest on activation.

## Instructions & Verification
1. Create `tests/playbook/activation.test.ts`.
2. Verify test fails: `bun test tests/playbook/activation.test.ts`.
3. Update `src/playbook/registry.ts` and `src/cli/handlers/playbook.ts`.
4. Run `bun test tests/playbook/activation.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
