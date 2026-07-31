# Dokion Playbook Authoring

This document explains how to author a Dokion playbook (`.dokion/playbook.json`) and how to place approval boundaries. It is reference material for the `dokion-automation` skill. Agents read this to advise users; agents do not author or modify playbooks autonomously.

The authoritative contract for the playbook shape is `schemas/dokion-playbook.schema.json`. Always validate the final file with `dokion validate` before relying on it.

## Mental model

A playbook is an immutable description of **what may run**, **in what order**, and **with what approvals**. It is the only execution authority. Dokion will:

- Refuse to run anything that is not declared.
- Refuse to run anything whose approvals have not been recorded.
- Refuse to expand a declared write scope at repair time.
- Refuse to continue past a `BLOCKED`, `FAILED`, `REPAIR_REJECTED`, or `TAINTED` state without an explicit user decision.

Because the playbook is the only place authority lives, every authoring decision is a security decision. Keep the file minimal, readable, and reviewable.

## File location and ownership

- Path: `.dokion/playbook.json`
- Owner: the user (Dokion runtime never writes to it).
- Agents: read-only. Any change requested by an agent must be expressed as an inert recommendation in `HARDENING.md` or chat. The user applies the change by editing this file directly.

A repository that does not yet contain a playbook gets one by running `dokion init` once, then editing the result.

## Top-level shape

Reference from `playbooks/example.playbook.json` and `schemas/dokion-playbook.schema.json`:

```json
{
  "version": 1,
  "name": "Project Hardening",
  "capabilities": [ ],
  "loops": [ ],
  "approvals": { }
}
```

### `capabilities`

Each entry names a capability from the inert catalog (`dokion.json`) and the permissions it may use. Capabilities do not auto-install. The user installs whatever tools the capability needs before running the playbook. Dokion then *verifies* availability at `dokion validate` time.

Authoring guidelines:

- Declare the minimum capability set that genuinely hardens the project.
- For each capability, list explicit allowed actions when the schema supports them. Avoid blanket grants.
- Reference exact tool versions where pinning is meaningful (lockfiles, container digests, action SHAs). Do not let Dokion or an agent pick a newer version mid-run.

### `loops`

A `loop` is a named, ordered set of `steps`. A step is the smallest unit of execution. See `playbooks/example.playbook.json` for working shapes (`Project Baseline`, security review, and code-quality review are common examples).

Fields commonly present on a step (per the schema):

- `id` — stable identifier; used by `dokion step`, `dokion approve step:<id>`, `dokion skip <step-id>`, and the runtime state.
- `name` — human label.
- `capability` — reference to a declared capability id.
- `command` or `commands` — the exact commands to run. Treat these as immutable at runtime; if a command needs to change, change the playbook.
- `writeScope` — list of path globs the step may write. Dokion enforces this strictly. Anything outside the scope is rejected and rolled back.
- `verification` — commands or checks that must exit 0 for the step to be considered green.
- `approval` — see "Approval boundaries" below.
- `required` — when `false`, the step may be skipped via `dokion skip <step-id> --reason ...`. When `true`, skipping is rejected.
- `dependsOn` — explicit step ids that must complete first.
- `onFailure` — `STOP` (default), `CONTINUE`, or `ROLLBACK`. Use `STOP` for anything that affects write scope or test integrity.

### `approvals`

Named approval policies that steps reference. Keeps policy text out of individual steps and makes review easier.

Common patterns:

- `always` — every run of this step pauses for explicit approval.
- `per-finding` — a single approval covers a generated finding; subsequent runs reuse it if the finding has not changed.
- `install-only` — only the installation of external tools requires approval; once installed, the step runs ungated.

## Approval boundaries

Approval boundaries are the primary safety valve. Place them deliberately.

### When to require approval

Require approval (`approval: "always"` or per-finding) on any step that:

- **Writes outside the build folder.** Examples: dependency manifests, CI workflow files, source files outside the declared write scope, `.dokion/**` itself.
- **Installs software.** Anything that fetches binaries or packages at run time.
- **Commits, branches, or pushes.** Any Git-mutating action.
- **Modifies test infrastructure.** Test files, mocks, snapshots, coverage thresholds.
- **Suppresses or disables checks.** Linters, typecheckers, security scanners, secret scanners.
- **Touches secrets, credentials, or auth configuration.**

### When approval is unnecessary

Steps that meet **all** of the following may run ungated:

- Read-only under version control or confined to build outputs.
- Idempotent and trivially reversible (`bun install --frozen-lockfile`, `bun test`, `bun run typecheck`, `dokion validate`).
- Have no network side effects beyond fetching already-pinned artifacts.

### How a gated step executes

1. The runtime reaches the step.
2. The runtime records a pending approval in `.dokion/state.json` and pauses the loop.
3. The user (via the agent) inspects `dokion status` and the proposed action.
4. The user issues `dokion approve step:<id> --by <identity> --notes "<reason>"` or `dokion reject step:<id> --by <identity> --notes "<reason>"`.
5. The runtime resumes with `dokion resume`. The decision is permanent in the append-only evidence chain.

Agents must never fabricate this record, modify evidence, or "interpret" conversational approval as a CLI approval. There is no `--force` flag and there is no override.

## Write scope

Every step that writes must declare `writeScope` explicitly. Guidelines:

- Be as narrow as the step allows. Prefer specific subpaths (`src/**/__tests__/**`) over broad globs (`src/**`).
- If two steps would need overlapping scopes, either split them or merge them into a single step with a unified scope.
- Never include `.dokion/**` in a step's write scope; that area belongs exclusively to the Dokion runtime.
- Never include `HARDENING.md`; Dokion owns it via `dokion report`.

Dokion enforces scope at the file system level during repairs. A step that escapes its scope is rolled back to its pre-remediation snapshot and flagged.

## Verification

Every step that performs remediation must declare a `verification` array. Each entry runs after the remediation and must exit 0.

Required components:

- The remediated command itself (for example `bun run typecheck`).
- The project's standard contract checks (in this repository: `bun test`, `bun run typecheck`, `bun run validate:contracts`, `bun run build`).
- Step-specific proofs (for example a regression test added for the finding).

A repair is accepted only when all of the following hold:

1. The remediation command exits 0.
2. The repair delta is contained in the declared `writeScope`.
3. No configured suppression or test-deletion check trips.
4. At least one required regression test was added or modified when the playbook calls for one.
5. Every entry in `verification` exits 0.

Treat any failure here as a non-ready state. Do not report as green.

## Testing the playbook

Before trusting a new playbook on a real run:

```bash
dokion validate          # Schema, capability availability, permissions, dependencies
dokion plan              # Rendered loop order, no execution
dokion doctor            # Tool availability, credentials, runtimes
dokion run               # First real run; expect pauses at gated steps
dokion findings          # Inspect after the run
dokion audit             # Verify evidence chain, approvals, write-scope adherence
dokion verify            # Final gate replay without applying fixes
dokion report            # Refresh HARDENING.md and machine-readable reports
```

Iterate on the playbook until `dokion audit` is clean and `dokion verify` is green.

## Anti-patterns

Avoid all of the following. Each has bitten a real team.

- **Wildcard write scopes** (`**/*`). Defeats scope enforcement and makes rollback unsafe.
- **Implicit capabilities.** Anything that runs but is not declared is a contract violation. Dokion will refuse at `dokion validate`, but discovery at runtime is too late.
- **Reused step ids across loops.** The runtime treats ids as stable identity; reuse causes state collisions. Use unique, descriptive ids.
- **Silent auto-fixers.** A step that rewrites code without a declared write scope, an approval gate, or a verification array is not a hardening step. It is an uncontrolled mutation.
- **Runtime `-y` / `--force` flags.** Anything that bypasses prompts at the tool level (for example `--yes` or `--no-confirm`) bypasses the audit trail. Replace with explicit `dokion approve` flows.
- **Treat upgrades as configuration.** Pinning a tool version in the playbook is a contract. Changing it changes the contract. Revalidate after any bump.
- **Editing `.dokion/playbook.json` mid-run.** Always stop the loop first (Ctrl+C works; the run re-enters via `dokion resume`). Never edit while a step is in flight.

## Reviewing a playbook

Before approving a new playbook as a reviewer, walk this checklist:

1. **Minimal capability set?** Each capability earns its place.
2. **Write scopes tight?** Every glob has a reason; nothing is `**`.
3. **Gates placed?** Installation, commits, secrets, test infrastructure, and anything outside the build folder are gated.
4. **Verifications complete?** Every remediation step includes the four Bun contract commands plus any step-specific proofs.
5. **Ids stable and unique?** No reuse across loops or versions.
6. **`dokion validate` green?** Run it before merging.

## Further reading

- `skills/dokion-automation/SKILL.md` — full lifecycle and command surface for agents
- `skills/dokion-hardening/SKILL.md` — run-and-resume skill for end users
- `playbooks/example.playbook.json` — working example with multiple loops
- `playbooks/reference/*.playbook.json` — archetype playbooks for common project shapes
- `docs/architecture/bounded-autopilot.md` — how the autopilot honors playbook boundaries
- `docs/security/threat-model.md` — why the playbook is the trust root
