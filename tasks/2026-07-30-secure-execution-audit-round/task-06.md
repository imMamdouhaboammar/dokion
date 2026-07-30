# Task 06: EXEC-001 Platform Command Strategy

## Objective

Implement EXEC-001 for Dokion at baseline `a1e1d55`. Return explicit POSIX behavior for macOS and Linux, explicit unsupported or degraded results for unproven platforms, and no silent shell fallback.

## Inputs and invariants

- Repository root: `/Users/mamdouhaboammar/Documents/antigravity/adventurous-mendel/dokion`
- Read `AGENTS.md`, `SPEC.md`, and the existing neighboring source and tests before editing.
- `.dokion/playbook.json` is the only execution authority. Do not edit or generate it.
- Use Bun and TypeScript only. Add no dependency.
- Preserve existing public APIs unless this brief explicitly introduces the interface below.

## Public interface

Implement and export: `resolveCommandStrategy(platform, command): CommandStrategyResult`

## Allowed production files

- `src/execution/command-strategy.ts`

## Allowed test files

- `tests/execution/command-strategy.test.ts`

## TDD contract

1. Add the focused test first.
2. Run `bun test tests/execution/command-strategy.test.ts` and record the expected failing assertion or missing symbol.
3. Implement the minimum production code.
4. Run `bun test tests/execution/command-strategy.test.ts` and `bun run typecheck`.
5. Run `git diff --check` and `git status --short`.

## Scope boundaries

- Do not edit files outside the allowed lists unless a TypeScript import index is strictly required. If that happens, report it before editing.
- Do not weaken, delete, skip, or suppress an existing test.
- Do not broaden authority, infer approval, install capabilities, or expose secret values.
- Do not modify unrelated formatting or documentation.

## Report contract

Write `task-report.md` in the worktree root containing: status, files changed, RED command and failure reason, GREEN commands and results, design decisions, remaining concerns, and exact `git status --short` output.

Do not run `git add`, `git commit`, `git merge`, `git rebase`, or `git push`. The Orchestrator alone lands verified work.
