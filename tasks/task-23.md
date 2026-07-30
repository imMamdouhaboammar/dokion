# Task 23: SARIF v2.1 Exporter (`EVID-006`)

## Overview
Implement `src/report/sarif.ts` to export normalized Dokion security findings as valid SARIF v2.1 JSON documents.

## Target Files
- `src/report/sarif.ts`
- `tests/report/sarif.test.ts`

## Scope Boundaries
- Must generate standard SARIF 2.1.0 schema logs for security tools and CI code scanning integration.

## Instructions & Verification
1. Create `tests/report/sarif.test.ts`.
2. Verify test fails: `bun test tests/report/sarif.test.ts`.
3. Implement `src/report/sarif.ts`.
4. Run `bun test tests/report/sarif.test.ts` and ensure 100% pass.
5. Run `bun run typecheck`.

## Report Contract
- Do NOT execute `git commit` or `git add`.
- Report completed files, test command output, and verification results.
