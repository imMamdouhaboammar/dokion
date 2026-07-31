# Dokion Atomic Commit and Review Policy

## Purpose

This policy defines the minimum evidence for a Dokion implementation commit. The goal is not a high commit count. The goal is a history where each change can be understood, verified, reverted, and reviewed without reconstructing unrelated work.

It applies to source code, schemas, tests, adapters, workflows, release logic, and normative documentation.

## Atomic commit contract

Every implementation commit must contain one reviewable behavior. A reviewer should be able to answer these questions from the diff and verification evidence:

1. What behavior changed?
2. What targeted failing test demonstrated the missing or broken behavior?
3. What is the smallest implementation that made it pass?
4. What authority boundary or safety property could this affect?
5. What command proves the result?
6. What is the rollback boundary if the change must be reverted?

A commit may touch several files when those files are required for the same behavior. File count does not determine atomicity. Behavioral cohesion does.

## What belongs in one commit

A valid implementation commit may contain all files required for the one behavior, including:

- the targeted failing test and final regression test
- production code or documentation that satisfies the test
- schema and type changes required by the behavior
- fixture data required to exercise it
- public documentation and adapter updates required to keep contracts truthful
- progress-ledger updates
- narrowly related refactoring needed to create a safe boundary

These files belong together when separating them would create a broken, misleading, untestable, or unreviewable state.

## Required behavior boundary

Before implementation, state the behavior in one sentence. A reviewer must be able to answer:

1. What changes for a user, operator, adapter, release owner, or maintainer?
2. Which invariant or contract proves the change?
3. Which files are allowed to change?
4. Which test fails before implementation?
5. Which command proves completion?
6. What is the rollback boundary if the change is rejected?

When these questions require unrelated answers, split the work into separate backlog items or commits.

## Test-first cycle

Every behavior change follows this sequence:

1. Write a targeted failing test.
2. Run the test and observe the expected RED failure.
3. Confirm that the failure is caused by missing behavior, not a typo, fixture error, unavailable dependency, or stale branch.
4. Write the minimum coherent implementation.
5. Run the targeted test and related tests until GREEN.
6. Run typecheck and contract validation.
7. Run the full phase gate required by the changed surfaces.
8. Review authority boundary and secret boundary implications.
9. Review the final diff and evidence before merge.

The targeted failing test may be exercised in temporary branch or pull request history. It does not have to remain as a failing commit on `main`.

## Scope rules

A valid commit has:

- one behavior or one inseparable contract change
- a targeted test or an explicit reason a test is not meaningful
- no unrelated formatting
- no opportunistic dependency upgrades
- no unrelated renaming or file movement
- no generated state or local artifacts
- a clear rollback boundary

Separate a refactor from a behavior change when either can stand alone. Keep them together only when separation would create a broken intermediate commit or duplicate unsafe work.

## Review contract

Reviewers evaluate the commit as one proof package:

1. **Scope:** Is there one reviewable behavior?
2. **Authority:** Can the change select, enable, install, reorder, broaden, or infer anything not approved by the user? (Check authority boundary)
3. **Inputs:** Which data is attacker-controlled, operator-controlled, or developer-controlled?
4. **Permissions:** Are filesystem, shell, environment, network, and write scopes explicit and minimal?
5. **Integrity:** Are state, events, evidence, approvals, repairs, and reports consistent and attributable?
6. **Failure behavior:** Does the code fail closed, roll back, stop, or request a decision correctly?
7. **Tests:** Was RED observed and does GREEN prove behavior rather than implementation detail?
8. **Portability:** Are agent, package, binary, and operating-system differences represented honestly?
9. **Distribution:** Does the exact shipped artifact match the verified source and dependency graph?
10. **Documentation:** Does documentation distinguish current behavior from planned behavior?
11. **Secrets:** Verify secret boundary (credentials, private tokens, local paths).

A reviewer should be able to reject one commit without rejecting an unrelated improvement. If not, the boundary is too broad.

## Verification levels

### Targeted verification

Run the smallest command that proves the new behavior directly. Examples include one Bun test file, one schema conformance case, one adapter validator, or one package inspection fixture.

### Related verification

Run tests for neighboring contracts and modules that consume the changed interface.

### Full phase gate

Every final head must pass:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

Distribution, adapter, package, binary, or release changes also require:

```bash
bun run validate:distribution
bun run smoke:package
bun run scripts/build-release.ts
bunx @google/gemini-cli@0.51.0 extensions validate .
```

A final success claim must cite fresh evidence for the exact head being merged.

## Prohibited commit patterns and generated residue

Do not commit generated state, `HARDENING.md`, `.dokion/**`, evidence, reports, logs, package archives, compiled binaries, private configuration, credentials, or local machine paths unless the release process explicitly defines that file as a source-controlled artifact.

### Artificial commit splitting

Artificial commit splitting is prohibited. Examples:

- one commit creates an empty file and the next fills it
- production code is split from the only test that makes it safe
- a schema is committed before every required consumer is updated
- one line of a single behavior is committed repeatedly to increase the count
- formatting-only commits are inserted between logically inseparable changes
- generated output is committed separately only to make another commit appear smaller

The target of 100 commits is a constraint on coherent delivery units, not an invitation to manufacture history.

### Mixed concerns

Do not combine:

- unrelated bugs or features
- broad cleanup not required by the behavior
- dependency upgrades with unrelated runtime changes
- documentation rewrites unrelated to the contract being changed
- security hardening from a separate trust boundary
- mass renaming or unrelated formatting

Unrelated formatting is especially harmful because it obscures security-sensitive diffs and makes blame and rollback less reliable.

### Unverified success

Do not merge based on:

- a model or agent saying the work is complete
- a targeted test without the full required gate
- a previous CI run for another head
- a successful build when tests or typecheck failed
- a scanner result without validating its command, provenance, and evidence
- documentation claims unsupported by code and CI

## Pull request and merge model

A feature branch may contain exploratory commits, a temporary RED history, narrow type fixes, review corrections, and progress updates while the pull request is under construction.

The pull request remains Draft until:

- final scope is stable
- required tests pass
- typecheck and contracts pass
- applicable distribution and adapter gates pass
- the final diff is reviewed
- temporary workflows, generators, diagnostics, credentials, binaries, archives, and local state are absent

Use Squash merge so the pull request lands as one coherent main-branch commit for the backlog item. The squash title must describe the behavior, not the branch mechanics. The squash body should identify the numbered backlog item and summarize the proof boundary.

## Rollback boundary

Each commit must define a practical rollback boundary:

- reverting the commit removes the behavior and its contract together
- repository schemas and generated representations do not remain half-migrated
- public documentation returns to the earlier truthful state
- adapters do not reference commands or contracts that no longer exist
- state migrations have an explicit compatibility and downgrade decision
- package or release changes identify immutable artifacts that cannot be deleted or rewritten

A change that cannot be reverted safely must document the migration, compatibility, and incident response before merge.

## Commit message convention

Use a Conventional Commits style prefix that reflects the delivered behavior:

- `feat:` new executable behavior
- `fix:` defect repair
- `refactor:` behavior-preserving structural change
- `test:` executable contract or test-system change
- `security:` security policy or mitigation
- `docs:` documentation and normative written contracts
- `ci:` workflow behavior
- `release:` packaging or publication behavior
- `perf:` measured performance behavior

The subject should be imperative, specific, and short enough to scan.
