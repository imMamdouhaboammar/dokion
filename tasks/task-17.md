# Task 17: Capability Digest & Git SHA Verifier (`CAP-003`, `CAP-004`)

## Overview
Implement `src/capability/verifier.ts` to verify binary SHA-256 digests and pinned Git commit SHAs recorded in `.dokion/capability-lock.json`.

## Target Files
- `src/capability/verifier.ts`
- `tests/capability/verifier.test.ts`

## Scope Boundaries
- Fails closed if capability executable SHA-256 digest or Git commit SHA mismatches lock.

## Instructions & Verification
1. Create `tests/capability/verifier.test.ts`.
2. Verify test fails: `bun test tests/capability/verifier.test.ts`.
3. Implement `src/capability/verifier.ts`.
4. Run `bun test tests/capability/verifier.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
