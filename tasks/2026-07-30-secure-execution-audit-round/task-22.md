# Task 22: EVID-008 Evidence Manifest and Checksums

    ## Objective

    Implement EVID-008 for Dokion at baseline `a1e1d55`. Create a sorted manifest with path, size, media type, digest, producer, run, commit, redaction status, and retention class. Detect missing, altered, duplicate, cross-run, and required unmanifested evidence.

    ## Inputs and invariants

    - Repository root: `/Users/mamdouhaboammar/Documents/antigravity/adventurous-mendel/dokion`
    - Read `AGENTS.md`, `SPEC.md`, and the existing neighboring source and tests before editing.
    - `.dokion/playbook.json` is the only execution authority. Do not edit or generate it.
    - Use Bun and TypeScript only. Add no dependency.
    - Preserve existing public APIs unless this brief explicitly introduces the interface below.

    ## Public interface

    Implement and export: `buildEvidenceManifest(root, metadata): Promise<EvidenceManifest>; verifyEvidenceManifest(root, manifest): Promise<EvidenceManifestVerification>`

    ## Allowed production files

    - `src/evidence/manifest.ts`
- `schemas/dokion-evidence-manifest.schema.json`

    ## Allowed test files

    - `tests/evidence/manifest.test.ts`

    ## TDD contract

    1. Add the focused test first.
    2. Run `bun test tests/evidence/manifest.test.ts` and record the expected failing assertion or missing symbol.
    3. Implement the minimum production code.
    4. Run `bun test tests/evidence/manifest.test.ts` and `bun run typecheck`.
    5. Run `git diff --check` and `git status --short`.

    ## Scope boundaries

    - Do not edit files outside the allowed lists unless a TypeScript import index is strictly required. If that happens, report it before editing.
    - Do not weaken, delete, skip, or suppress an existing test.
    - Do not broaden authority, infer approval, install capabilities, or expose secret values.
    - Do not modify unrelated formatting or documentation.

    ## Report contract

    Write `task-report.md` in the worktree root containing: status, files changed, RED command and failure reason, GREEN commands and results, design decisions, remaining concerns, and exact `git status --short` output.

    Do not run `git add`, `git commit`, `git merge`, `git rebase`, or `git push`. The Orchestrator alone lands verified work.
