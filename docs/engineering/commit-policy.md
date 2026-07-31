# Dokion Atomic Commit and Review Policy

## Policy statement

One backlog item, one main-branch commit.

A Dokion implementation commit is the smallest unit that delivers one reviewable behavior, carries its own test and verification evidence, and can be accepted, rejected, reverted, or investigated without depending on unrelated work.

The goal is not the smallest possible diff. The goal is the smallest coherent proof boundary.

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
8. Review the final diff and evidence before merge.

The targeted failing test may be exercised in temporary branch or pull request history. It does not have to remain as a failing commit on `main`.

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

A merge commit or rebase merge is acceptable only when the branch history itself is deliberately curated as independently meaningful commits and the result does not violate the one-item boundary. The 100-commit production backlog uses squash by default.

## Rollback boundary

Each commit must define a practical rollback boundary:

- reverting the commit removes the behavior and its contract together
- repository schemas and generated representations do not remain half-migrated
- public documentation returns to the earlier truthful state
- adapters do not reference commands or contracts that no longer exist
- state migrations have an explicit compatibility and downgrade decision
- package or release changes identify immutable artifacts that cannot be deleted or rewritten

A change that cannot be reverted safely must document the migration, compatibility, and incident response before merge.

## Review rules

Reviewers evaluate the commit as one proof package:

1. **Scope:** Is there one reviewable behavior?
2. **Authority:** Can the change select, enable, install, reorder, broaden, or infer anything not approved by the user?
3. **Inputs:** Which data is attacker-controlled, operator-controlled, or developer-controlled?
4. **Permissions:** Are filesystem, shell, environment, network, and write scopes explicit and minimal?
5. **Integrity:** Are state, events, evidence, approvals, repairs, and reports consistent and attributable?
6. **Failure behavior:** Does the code fail closed, roll back, stop, or request a decision correctly?
7. **Tests:** Was RED observed and does GREEN prove behavior rather than implementation detail?
8. **Portability:** Are agent, package, binary, and operating-system differences represented honestly?
9. **Distribution:** Does the exact shipped artifact match the verified source and dependency graph?
10. **Documentation:** Does documentation distinguish current behavior from planned behavior?

A reviewer should be able to reject one commit without rejecting an unrelated improvement. If not, the boundary is too broad.

## Prohibited commit patterns

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

### Hidden generated or local residue

Do not commit:

- `.dokion/**` runtime state
- `HARDENING.md` generated during repository tests
- diagnostic logs
- package archives or compiled binaries unless the release policy explicitly requires tracked artifacts
- `.env`, `.npmrc`, `bunfig.toml`, credentials, private MCP configuration, or private local paths
- temporary workflows, builder scripts, or generation probes used only to assemble a branch

## Ordering exceptions

The numbered backlog is implemented in order unless a safety dependency must move earlier.

An ordering exception is valid only when:

1. the current item cannot be implemented or verified safely without the dependency
2. the dependency is already a separately reviewable backlog item or is added as one
3. the reason and new order are recorded in [`docs/progress/production-backlog-progress.md`](../progress/production-backlog-progress.md)
4. no later feature is smuggled into the dependency commit
5. the total remains exactly 100 implementation commits unless the user explicitly revises the plan

A convenience preference, available tool, or desire to avoid a difficult test is not an ordering exception.

## Documentation-only and contract-only commits

Documentation-only commits are valid when documentation is itself the contract or security control, such as:

- an audited baseline
- an authority or runtime ADR
- a repository threat model
- a production-readiness definition
- a contribution or release policy

They still require a targeted contract test when the repository depends on the document's presence, headings, markers, or links to prevent drift.

## Dependency and tool changes

A dependency or tool change must be isolated when it changes trust, provenance, install behavior, runtime semantics, package contents, binary output, workflow permissions, or release evidence.

Do not hide a dependency update inside a feature commit unless the feature cannot exist without it and the update is part of the same reviewed security boundary.

Dokion repository package operations remain Bun-only under ADR-0002.

## Progress ledger

After an implementation item is merged or reaches final PR verification, update [`docs/progress/production-backlog-progress.md`](../progress/production-backlog-progress.md) with:

- item number
- status
- final main SHA when available
- pull request number
- RED evidence
- final CI run and passed gates
- type, security, or review corrections that materially affected verification
- any approved ordering exception

A commit cannot contain its own final main SHA. The row may use `pending` during review and the next item records the merged SHA.

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

The subject should be imperative, specific, and short enough to scan. Do not include percentages, unverifiable adjectives, or claims such as "fully secure" or "production ready".

## Final merge checklist

Before marking a pull request Ready:

- [ ] one backlog item and one behavior boundary
- [ ] targeted RED failure recorded
- [ ] targeted and related tests green
- [ ] full phase gate green on the exact final head
- [ ] changed-file list contains no unrelated files
- [ ] no unrelated formatting
- [ ] authority and permission review complete
- [ ] secret and private-path review complete
- [ ] rollback boundary understood
- [ ] documentation and adapters aligned
- [ ] progress ledger updated
- [ ] squash title and body describe the coherent main-branch commit
