# Task 09: EXEC-004 Bounded Output Evidence Spool

## Objective

Implement EXEC-004 for Dokion at baseline `a1e1d55`. Stream bytes to an evidence artifact with digest, size, truncation marker, media type, and bounded in-memory summary. Never buffer unbounded output.

## Inputs and invariants

- Repository root: `/Users/mamdouhaboammar/Documents/antigravity/adventurous-mendel/dokion`
- Read `AGENTS.md`, `SPEC.md`, and the existing neighboring source and tests before editing.
- `.dokion/playbook.json` is the only execution authority. Do not edit or generate it.
- Use Bun and TypeScript only. Add no dependency.
- Preserve existing public APIs unless this brief explicitly introduces the interface below.

## Public interface

Implement and export: `spoolOutput(stream, options): Promise<OutputSpoolResult>`

## Allowed production files

- `src/execution/output-spool.ts`

## Allowed test files

- `tests/execution/output-spool.test.ts`

## TDD contract

1. Add the focused test first.
2. Run `bun test tests/execution/output-spool.test.ts` and record the expected failing assertion or missing symbol.
3. Implement the minimum production code.
4. Run `bun test tests/execution/output-spool.test.ts` and `bun run typecheck`.
5. Run `git diff --check` and `git status --short`.

## Scope boundaries

- Do not edit files outside the allowed lists unless a TypeScript import index is strictly required. If that happens, report it before editing.
- Do not weaken, delete, skip, or suppress an existing test.
- Do not broaden authority, infer approval, install capabilities, or expose secret values.
- Do not modify unrelated formatting or documentation.

## Report contract

Write `task-report.md` in the worktree root containing: status, files changed, RED command and failure reason, GREEN commands and results, design decisions, remaining concerns, and exact `git status --short` output.

Do not run `git add`, `git commit`, `git merge`, `git rebase`, or `git push`. The Orchestrator alone lands verified work.
