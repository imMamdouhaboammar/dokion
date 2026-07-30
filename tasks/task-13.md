# Task 13: Built-in Playbook Registry & Catalog Loader (`PLAY-001`, `PLAY-002`)

## Overview
Implement `src/playbook/registry.ts` to load shipped built-in playbooks (`web-fullstack`, `api-service`, `library-package`) deterministically.

## Target Files
- `src/playbook/registry.ts`
- `tests/playbook/registry.test.ts`

## Scope Boundaries
- Must validate playbooks against `dokion-playbook.schema.json`.
- Built-in playbooks are read-only catalogs; they must never be directly mutated.

## Instructions & Verification
1. Create `tests/playbook/registry.test.ts`.
2. Verify test fails: `bun test tests/playbook/registry.test.ts`.
3. Implement `src/playbook/registry.ts`.
4. Run `bun test tests/playbook/registry.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
