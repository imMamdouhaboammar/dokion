# Dokion

Dokion is a user-directed runtime for executing software hardening Playbooks across coding agents and local tools.

It validates the selected Playbook, preserves execution order, records evidence, normalizes findings, verifies repairs, and restores rejected changes. Dokion does not choose capabilities or grant itself new authority.

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

The built-in runtime and user-authored Playbooks are available.

The previous Community Hub was a simulation and has been quarantined. Registry search, pull, install, publish, ratings, downloads, publisher identity, and leaderboard data must not be treated as implemented.

The replacement Registry is being built as a federated, content-addressed protocol with:

- independently configured local, HTTPS, and commit-pinned Git sources
- exact package versions and SHA-256 digests
- deterministic package manifests
- separate integrity, source, identity, signature, compatibility, deprecation, and revocation states
- inert installation followed by a separate explicit activation decision
- an auditable project lockfile
- no mandatory hosted API

Protocol contracts and their current status are documented in:

- [`docs/protocol/registry-v1.md`](docs/protocol/registry-v1.md)
- [`docs/protocol/registry-schema-conventions.md`](docs/protocol/registry-schema-conventions.md)
- [`docs/adr/0003-federated-content-addressed-playbook-registry.md`](docs/adr/0003-federated-content-addressed-playbook-registry.md)
- [`docs/adr/0004-registry-trust-installation-and-activation.md`](docs/adr/0004-registry-trust-installation-and-activation.md)
- [`docs/adr/0005-public-site-is-not-registry-authority.md`](docs/adr/0005-public-site-is-not-registry-authority.md)

## Authority model

`dokion.json` is an inert catalog. It describes available commands, capabilities, policies, and loops.

`.dokion/playbook.json` is the sole execution authority. The user controls:

- capability selection
- execution order
- permissions and write scope
- approval rules
- retry and timeout policy
- verification commands
- release gates

Dokion must not:

- install an undeclared capability
- replace a declared capability
- reorder steps
- expand write scope
- activate an installed package automatically
- hide or silence findings without an explicit decision
- report success without execution and verification evidence

## Execution lifecycle

```text
Inspect project
    ↓
Validate catalog and active Playbook
    ↓
Render the exact approved plan
    ↓
Execute one step at a time
    ↓
Capture evidence and normalized findings
    ↓
Verify the claimed result
    ↓
Accept the change or restore the pre-repair snapshot
    ↓
Write state and HARDENING.md
```

A step is not successful because a command exited with code zero. The runtime requires the evidence and verification contract declared by the Playbook.

## Installation

Global installation with Bun:

```bash
bun add --global dokion
```

Repository-local installation:

```bash
bun add --dev dokion
```

Development requirements:

- Bun `1.3.14`
- Python `3.13` for schema conformance in CI
- Git for snapshot, rollback, and repository-state verification

## Minimal workflow

Initialize project state:

```bash
dokion init
```

Create or copy the active Playbook:

```text
.dokion/playbook.json
```

Validate it:

```bash
dokion validate
```

Inspect the exact plan without executing changes:

```bash
dokion plan
```

Execute the approved Playbook:

```bash
dokion run
```

Inspect state and findings:

```bash
dokion status
dokion findings
dokion report
```

## CLI status

Implemented command groups include:

```text
Observe
  inspect
  doctor
  status
  findings
  report
  audit
  compare

Configure
  init
  plan
  configure
  validate
  create
  playbooks import|validate|list

Execute and govern
  run
  step
  resume
  verify
  approve
  reject
  skip
```

`dokion hub` is registered as planned but intentionally has no runtime case, help entry, or agent command file. It fails closed until the replacement Registry lifecycle is implemented and verified.

`dokion playbooks sync` also fails closed because Registry synchronization and installation are not implemented yet.

## Repository layout

```text
src/                    Runtime, CLI, execution, evidence, and state logic
tests/                  Unit, contract, integration, and negative-control tests
schemas/                Runtime and Registry JSON Schemas
skills/                 Canonical agent-facing procedures
commands/dokion/        Gemini CLI command adapters
docs/architecture/      Current system boundaries and audits
docs/adr/               Accepted architectural decisions
docs/protocol/          Registry protocol contracts
docs/superpowers/       Design specifications and implementation plans
.github/workflows/       CI, release, and GitHub Pages workflows
```

## Verification

Run the complete repository checks:

```bash
bun install --frozen-lockfile
python3 schemas/conformance_test.py
python3 schemas/registry/conformance_test.py
bun run validate:contracts
bun test
bun run typecheck
bun run build
bun run validate:distribution
bun run smoke:package
```

The CI pipeline also builds five release binaries, runs a clean-install smoke test, validates the Gemini extension, and rejects tracked mutation or credential residue.

## Security model

Dokion defaults to explicit authority and fail-closed behavior.

Security-sensitive work includes:

- bounded command execution
- sanitized evidence
- exact path and command validation
- approval records
- pre-repair snapshots
- rollback after failed remediation or verification
- immutable Playbook digest checks
- scanner-specific exit-code handling

The Registry program adds further controls for package traversal, archive bombs, symlinks, hardlinks, mutable references, digest substitution, downgrade, replay, cache poisoning, unsafe Git invocation, and publication authority.

See [`SECURITY.md`](SECURITY.md) and the accepted ADRs for the current boundaries.

## Documentation site

The current GitHub Pages surface is a temporary truthful landing page. The planned documentation application and Store must read generated, validated protocol snapshots. The website will not be the source of package authority.

The application work is tracked in [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47).

## Contributing

Changes should be delivered through reviewable pull requests with:

- a stated contract or behavior
- negative controls where failure matters
- tests before or with the implementation
- documentation that matches actual behavior
- no unsupported product claims
- no secret material or generated residue
- migration and rollback notes when state changes

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

## License

MIT. See [`LICENSE`](LICENSE).

<!-- project-story:start -->
<!-- This bounded section may be refreshed by repository automation. -->
<!-- project-story:end -->
