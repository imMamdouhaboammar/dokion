# Contributing to Dokion

Dokion is a user-directed hardening runtime. Changes must preserve the authority model, evidence integrity, and Bun-only development path.

Read these files before editing:

- `AGENTS.md` for repository rules
- `SPEC.md` for normative behavior
- `docs/engineering/commit-policy.md` for commit and review requirements
- `docs/security/threat-model.md` for trust boundaries

## Development environment

Dokion requires Bun 1.3.14 or newer. Do not replace Bun with npm, yarn, or pnpm.

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

Run targeted tests while developing. Run the full gate before claiming a change is ready.

## Change process

1. Start from an isolated branch or worktree.
2. Preserve unrelated user changes.
3. Read the relevant contracts and existing tests.
4. Add a targeted failing test before production behavior changes.
5. Implement the smallest change that passes the test.
6. Review authority, scope, evidence, and secret handling.
7. Run the required verification commands.
8. Commit one coherent behavior using the repository commit policy.

## Authority-sensitive changes

Treat these areas as safety-critical:

- active playbook loading and digest checks
- approvals and finding lifecycle transitions
- command execution and environment handling
- repair snapshots, validation, and rollback
- state, events, evidence, and readiness claims
- cross-agent adapters and platform degradations

A change must not select, install, substitute, reorder, upgrade, or enable a capability for the user. It must not activate a proposed playbook, widen write scope, weaken gates, or turn an unverified repair into a successful result.

## Pull requests

A pull request should state:

- the single behavior changed
- the failure demonstrated before implementation
- the verification commands and results
- authority or security boundaries reviewed
- known limitations or follow-up work

Keep unrelated refactors, formatting, generated artifacts, and dependency changes out of the pull request.

## Generated and private files

Do not commit generated state, `HARDENING.md`, evidence, reports, logs, credentials, private MCP configuration, package archives, compiled binaries, or local machine paths unless a release workflow explicitly owns the artifact.

## Reporting security issues

Follow `SECURITY.md` for private vulnerability reporting. Do not open a public issue containing an exploitable security defect or secret.
