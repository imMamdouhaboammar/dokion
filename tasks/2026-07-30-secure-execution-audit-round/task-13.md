# Task 13: EXEC-007 Bounded Ignored-File Policy

## Objective

Implement EXEC-007 for Dokion at baseline `a1e1d55`. Include only explicitly declared ignored paths within file-count and byte limits. Exclude dependency trees, caches, credentials, and generated bulk directories by default.

## Inputs and invariants

- Repository root: `/Users/mamdouhaboammar/Documents/antigravity/adventurous-mendel/dokion`
- Read `AGENTS.md`, `SPEC.md`, and the existing neighboring source and tests before editing.
- `.dokion/playbook.json` is the only execution authority. Do not edit or generate it.
- Use Bun and TypeScript only. Add no dependency.
- Preserve existing public APIs unless this brief explicitly introduces the interface below.

## Public interface

Implement and export: `collectDeclaredIgnoredFiles(root, policy): Promise<IgnoredFileCollection>`

## Allowed production files

- `src/validation/ignored-file-policy.ts`

## Allowed test files

- `tests/validation/ignored-files.test.ts`

## TDD contract

1. Add the focused test first.
2. Run `bun test tests/validation/ignored-files.test.ts` and record the expected failing assertion or missing symbol.
3. Implement the minimum production code.
4. Run `bun test tests/validation/ignored-files.test.ts` and `bun run typecheck`.
5. Run `git diff --check` and `git status --short`.

## Scope boundaries

- Do not edit files outside the allowed lists unless a TypeScript import index is strictly required. If that happens, report it before editing.
- Do not weaken, delete, skip, or suppress an existing test.
- Do not broaden authority, infer approval, install capabilities, or expose secret values.
- Do not modify unrelated formatting or documentation.

## Report contract

Write `task-report.md` in the worktree root containing: status, files changed, RED command and failure reason, GREEN commands and results, design decisions, remaining concerns, and exact `git status --short` output.

Do not run `git add`, `git commit`, `git merge`, `git rebase`, or `git push`. The Orchestrator alone lands verified work.
