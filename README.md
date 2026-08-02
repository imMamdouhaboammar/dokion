# Dokion

> **Execution control for user-authored engineering Playbooks**
>
> Dokion preserves declared order, permissions, approvals, state, evidence, verification boundaries, and repair decisions without selecting capabilities for the user

[![Bun Baseline](https://img.shields.io/badge/bun-v1.3.14-black.svg?style=flat&logo=bun)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release Line](https://img.shields.io/badge/release-0.3.x-green.svg)](https://github.com/imMamdouhaboammar/dokion)

> Current release line: `0.3.x`
>
> Runtime baseline: M0-M6 implemented
>
> Audited runtime baseline: [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md)
>
> Production hardening backlog: in progress
>
> Compatibility matrix: [`docs/compatibility.md`](docs/compatibility.md)
>
> Federated Playbook Registry: protocol work in progress under [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47)

## Current truth boundary

The built-in runtime and user-authored Playbooks are available

The runtime can validate and execute the active `.dokion/playbook.json`, preserve ordered state, record findings and evidence, enforce declared approvals and write scopes, resume supported runs, and verify repair transactions where the active Playbook declares the required commands and policies

Registry package building, read-only package verification, and digest-anchored artifact pull into an immutable cache are implemented. Registry installation, activation, publishing, and Store behavior are unavailable

The replacement Registry is being built as a federated, content-addressed protocol under [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47)

The guided Secure Release Pack, exact proposal activation flow, and versioned Run Trace are planned under [Issue #54](https://github.com/imMamdouhaboammar/dokion/issues/54). They are not current release features

`dokion verify` currently validates repository and Playbook contracts. It does not yet re-run the active Playbook's declared test and build gates as an independent verification operation

## What Dokion controls

A Skill, tool, scanner, or agent adapter provides a capability

A Dokion Playbook is the user-authored execution contract that declares:

- Capability identity and source
- Step and stage order
- Read, write, shell, and network permissions
- Approval boundaries
- Failure and retry policy
- Verification commands and release conditions
- Applicability and coverage assignments

Dokion executes only the active Playbook. It does not infer a replacement capability, widen permissions, reorder steps, or install an undeclared dependency

## Authority model

`dokion.json` is an inert catalog

`.dokion/playbook.json` is the sole execution authority

The user controls capability selection, execution order, write scope, commands, approvals, and required gates

The runtime is designed to fail closed when authority, evidence, repository identity, or persisted state cannot be verified

Platform guarantees differ by adapter and host. Read [`docs/compatibility.md`](docs/compatibility.md) before relying on hooks, process isolation, subagent behavior, or operating-system support

## Installation

Dokion uses Bun `1.3.14` or later

```bash
bun add --global dokion@0.3.0
```

Project-local installation:

```bash
bun add --dev dokion@0.3.0
```

Git is required for repository identity, worktree policy, repair snapshots, and rollback checks

Python is used by repository maintainers for schema conformance checks. It is not required for every installed CLI operation

## Current quickstart

Initialize Dokion-owned state and the active Playbook path:

```bash
dokion init
```

Review `.dokion/playbook.json` before execution. The file is authority, not a generated recommendation

Inspect the project and local prerequisites:

```bash
dokion inspect
dokion doctor
```

Validate the active Playbook and repository contracts:

```bash
dokion validate
```

Preview declared order and permissions without executing steps:

```bash
dokion plan
```

Execute through the production engine:

```bash
dokion run
```

Inspect recorded state and evidence:

```bash
dokion status
dokion findings
dokion report
```

Resume only when the persisted state and repository identity remain valid:

```bash
dokion resume
```

## Verification and rollback scope

Verification commands run as part of the declared execution path and repair transaction checks

A repair is accepted only when its declared command succeeds, its delta remains in scope, suppression and test-deletion checks pass, required regression evidence exists, and declared verification commands succeed

Rollback applies to supported repair transactions with a captured pre-repair snapshot. Dokion does not claim that every command, every Playbook step, or every external side effect is automatically reversible

The independent `dokion verify` correction remains part of Issue #54 and must not be used as proof of fresh build or test execution in the current release

## CLI status

Implemented command status is derived from `src/cli/command-registry.ts`

Important current commands:

```text
Observe
  dokion inspect
  dokion doctor
  dokion status
  dokion findings
  dokion report
  dokion audit
  dokion compare

Configure
  dokion init
  dokion plan
  dokion configure
  dokion validate
  dokion create
  dokion playbooks
  dokion registry

Execute and decide
  dokion run
  dokion step
  dokion resume
  dokion approve
  dokion reject
  dokion skip
  dokion autopilot
```

Run `dokion --help` for the registry-derived command list

## Registry status

Implemented:

- Deterministic package construction
- Read-only package verification
- Local, bounded HTTPS, and pinned Git source policy
- Digest verification
- Immutable content-addressed cache publication
- Cache-hit re-verification

Unavailable:

- Package installation
- Lockfile mutation through pull
- Package activation
- Registry publishing
- Ratings, rankings, download metrics, or trust scores

Registry metadata grants no selection, installation, activation, substitution, or execution authority

## Agent adapters

Packaged adapters currently exist for Claude Code, Codex, and Gemini CLI

Packaging does not imply identical platform guarantees. Adapter-specific degradations are recorded and documented in [`docs/compatibility.md`](docs/compatibility.md)

Cursor, AGY, and other environments must not be treated as tested merely because they can read generic repository instructions

## GitHub Action status

The root composite `action.yml` is an experimental repository integration until its release-candidate workflow passes on the exact tagged commit

It requires the canonical active authority file at `.dokion/playbook.json`, uses supported CLI syntax only, and does not accept another Playbook path as runtime authority

Do not describe the Action as release-proven until the corresponding workflow and package checks pass for the release candidate

## Contributing

```bash
bun install --frozen-lockfile
bun run validate:contracts
bun test
bun run typecheck
bun run build
bun run validate:distribution
bun run smoke:package
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md), and the accepted architecture decisions under [`docs/adr/`](docs/adr/)

## License

MIT © [Mamdouh Aboammar](https://github.com/imMamdouhaboammar). See [`LICENSE`](LICENSE)
