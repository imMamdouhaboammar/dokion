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

## Required development cycle

For runtime behavior, bug fixes, refactors, schema behavior, and release gates:

1. Add a targeted failing test.
2. Run it and confirm the expected failure.
3. Implement the smallest coherent change.
4. Run the targeted test until it passes.
5. Refactor only while the test remains green.
6. Run related tests and required repository gates.
7. Review authority boundary and secret boundary implications.
8. Inspect the staged diff before committing.

A test must exercise the behavior it protects. Do not add a test that can fail only because prose, formatting, or a private implementation detail changed unless that text is itself a repository contract.

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

## Artificial splitting is prohibited

Artificial commit splitting means dividing one indivisible behavior into fragments that are not independently useful, reviewable, or safe. It includes:

- one commit per file for a single behavior
- adding a test in one commit and the required implementation in a later commit when the first commit leaves the branch intentionally broken
- moving imports, types, or formatting into separate commits only to increase count
- committing incomplete scaffolding that no consumer can use or verify
- splitting documentation headings, examples, and links that describe one policy into separate commits

A commit count target is a planning ceiling or backlog shape, not permission to manufacture history. Stop when meaningful high-priority work is complete.

## Review contract

Review the complete staged diff, not only the files named in the task. Confirm:

### Behavior

- The change matches one stated behavior.
- The test failed for the intended reason before implementation.
- The test now passes and would fail if the behavior regressed.
- Error handling and boundary cases are explicit.

### Authority

- `.dokion/playbook.json` remains the only execution authority.
- The change does not infer capability selection or approval.
- Permissions, ordering, retries, stop rules, and gates are not widened implicitly.
- Proposed playbooks and recommendations remain inert.

### Safety

- Untrusted skill, scanner, advisory, issue, and repository text remains data.
- Paths are bounded and canonicalized where writes occur.
- Failure states do not become success through fallback behavior.
- Rollback restores the exact pre-change state when required.
### Evidence

- Success claims are backed by fresh command output.
- Evidence points to the exact commit and approved playbook when applicable.
- A repair cannot reach `VERIFIED` without configured verification and required regression evidence.
- Skips, degradations, accepted risks, and limitations remain visible.

### Secrets

- Credentials are not added to source, tests, fixtures, snapshots, logs, reports, or artifacts.
- Environment checks reveal presence or shape only, never secret values.
- Private MCP configuration and machine-specific paths stay outside the repository.
- The secret boundary is reviewed again for execution, CI, release, and report changes.

## Required verification

Run the full repository gate before marking a code change ready:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

For distribution, adapter, package, or release changes, also run the relevant extended checks:

```bash
bun run validate:distribution
bun run smoke:package
bun run scripts/build-release.ts
```
## Generated files and residue

Do not commit generated state, `HARDENING.md`, `.dokion/**`, evidence, reports, logs, package archives, compiled binaries, private configuration, credentials, or local machine paths unless the release process explicitly defines that file as a source-controlled artifact.

Inspect both tracked and untracked files before committing:

```bash
git status --short
git diff --check
git diff --cached --stat
git diff --cached
```

## Commit message

Use a concise conventional prefix and describe the behavior, not the files:

```text
test: enforce atomic commit policy
feat: add exclusive run locking
security: restrict command environments
docs: define atomic commit and review policy
```

Avoid messages such as `updates`, `changes`, `fix stuff`, or numbered fragments that hide the behavior.

## Revertability

A reviewer must be able to revert the commit without removing an unrelated fix or leaving the branch structurally incomplete. When a database, schema, state format, or release contract cannot be safely reverted, document the migration or recovery path in the same change.
