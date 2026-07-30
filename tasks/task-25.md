# Task 25: Evidence Manifests & Independent Audit Command (`EVID-008`, `EVID-010`)

## Overview
Implement `src/evidence/manifest.ts` and `src/cli/handlers/audit.ts` to compute SHA-256 evidence tree manifests and execute independent audits via `dokion audit`.

## Target Files
- `src/evidence/manifest.ts`
- `src/cli/handlers/audit.ts`
- `tests/cli/audit.test.ts`

## Scope Boundaries
- Compute SHA-256 digests across all `.dokion/evidence/` artifacts.
- `dokion audit` verifies evidence integrity against the recorded hash chain and manifests.

## Instructions & Verification
1. Create `tests/cli/audit.test.ts`.
2. Verify test fails: `bun test tests/cli/audit.test.ts`.
3. Implement `src/evidence/manifest.ts` and `src/cli/handlers/audit.ts`.
4. Run `bun test tests/cli/audit.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
