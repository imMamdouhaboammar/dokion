# Task 16: Capability Lock Engine & Resolution (`CAP-001`, `CAP-002`)

## Overview
Implement `src/capability/lock.ts` and `src/capability/resolver.ts` to manage `.dokion/capability-lock.json` and resolve declared capability executables deterministically.

## Target Files
- `src/capability/lock.ts`
- `src/capability/resolver.ts`
- `tests/capability/lock.test.ts`

## Scope Boundaries
- Resolves executable binaries, semver bounds, and paths.
- Writes or loads `.dokion/capability-lock.json`.

## Instructions & Verification
1. Create `tests/capability/lock.test.ts`.
2. Verify test fails: `bun test tests/capability/lock.test.ts`.
3. Implement `src/capability/lock.ts` and `src/capability/resolver.ts`.
4. Run `bun test tests/capability/lock.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
