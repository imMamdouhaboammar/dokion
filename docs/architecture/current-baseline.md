# Dokion Audited Production Baseline

## Purpose

This document records the repository state that the production-grade bounded-autopilot backlog was designed against. It is a historical baseline, not a claim that Dokion or a repository checked by Dokion is generally production ready.

## Audit identity

- Repository: `imMamdouhaboammar/dokion`
- Audited source commit: `c254af2f5a4d07c9f1f3b84d6c0226760702bbbb`
- Audit date: `2026-07-25`
- Package version: `0.3.0`
- Required runtime: Bun 1.3.14 or newer
- Language: TypeScript with strict checking
- Implemented milestone range: M0-M6

The backlog planning commit that follows this audited source is documentation-only and does not change the runtime baseline described here.

## Implemented milestone inventory

| Milestone | Audited implementation |
| --- | --- |
| M0 | JSON Schema contracts, conformance checks, Bun test harness, strict TypeScript, and CI validation |
| M1 | Active playbook loading, SHA-256 digest pinning, mutation detection, and Claude Code playbook guard |
| M2 | Ordered stage and step execution, state persistence, event journaling, evidence capture, reporting, and resume |
| M3 | Normalized findings, approval records, declared remediation commands, verification, and finding lifecycle persistence |
| M4 | Applicability evaluation, coverage and release gates, repair snapshots, adversarial validation, regression-test evidence, exact rollback, and seeded repair tests |
| M5 | One canonical hardening skill, Claude Code, Codex, and Gemini CLI adapters, conservative platform detection, and explicit degradation reporting |
| M6 | Embedded runtime assets, exact package inspection, clean-install testing, five cross-compiled binaries, protected tag release automation, and Bun registry publication |

## Authority and execution model

The audited runtime preserves these invariants:

1. `.dokion/playbook.json` is the only execution authority.
2. `dokion.json` is an inert catalog and does not enable a capability.
3. The user owns capability selection, order, permissions, approvals, retries, stop rules, verification commands, and release gates.
4. Dokion may validate and execute approved declarations, persist evidence, resume from disk, and write inert recommendations.
5. Dokion may not select, install, substitute, reorder, upgrade, or enable a capability.
6. A repair does not count as verified until the repair command, adversarial validation, declared verification commands, and required regression-test evidence all pass.
7. Completion language must remain qualified by the tested commit, approved playbook, evidence, gates, coverage, and recorded degradations.

## Supported execution surfaces

The audited package contains adapters or guidance for:

- Claude Code through the plugin manifest, canonical skill wrapper, and pre-tool playbook guard
- Codex through `AGENTS.md`, `.codex/AGENTS.md`, and the canonical Agent Skills package
- Gemini CLI through `gemini-extension.json`, `GEMINI.md`, and namespaced command files
- ordinary shell use through the installed `dokion` CLI

These surfaces do not have identical enforcement capabilities. The runtime records missing hook enforcement, subagent isolation, parallel-write isolation, and worktree isolation as degradations instead of treating every agent as equivalent.

## Shipped CLI surface

### Observe

- `dokion inspect`
- `dokion doctor`
- `dokion status`
- `dokion findings`
- `dokion report`
- `dokion tools list`
- `dokion skills list`
- `dokion plugins list`
- `dokion loops list`

### Configure

- `dokion init`
- `dokion validate`
- `dokion validate --catalog-only`

### Execute and decide

- `dokion run`
- `dokion resume`
- `dokion verify`
- `dokion approve <step:id|finding:id> --by <identity> [--notes <text>]`
- `dokion reject <step:id|finding:id> --by <identity> [--notes <text>]`

The specification and manifest also describe commands that were not implemented at the audited commit. Those gaps include `dokion plan`, `dokion configure`, `dokion step`, `dokion skip`, and `dokion reset --state-only`.

## Contract inventory

The audited repository ships and validates these primary JSON Schema contracts:

- `schemas/dokion-manifest.schema.json`
- `schemas/dokion-playbook.schema.json`
- `schemas/dokion-state.schema.json`
- `schemas/dokion-finding.schema.json`
- `schemas/capability-lock.schema.json`
- `schemas/dokion-coverage-assignment.schema.json`

The package embeds the runtime schemas and built-in inert catalog so installed package and standalone binary modes do not depend on the repository source tree.

## Reference playbooks

The audited package contains inert reference playbooks for:

- Full-stack web applications
- API services
- Published library packages

A reference playbook is not active by presence. A user must copy and edit it, replace placeholders, pin immutable capability references, remove unwanted steps, and approve the resulting `.dokion/playbook.json`.

## Test and release evidence at the audited source

The repository includes Bun tests covering runtime order and resume, playbook mutation, findings and remediation, applicability, coverage, release gates, adversarial repair validation, rollback, platform adapters, the Claude guard, distribution policy, and release workflow contracts.

The primary automation files are:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

The CI workflow installs frozen Bun dependencies, runs schema conformance, runtime contracts, Bun tests, TypeScript checking, compiled build checks, release-binary smoke tests, package validation, clean-install testing, Gemini extension validation, and source-tree residue checks.

The tag release workflow repeats the runtime and distribution gates, builds Linux x64, Linux ARM64, macOS ARM64, macOS x64, and Windows x64 binaries, creates SHA-256 checksums, publishes an immutable package version through the protected `npm-release` environment, and creates or updates a GitHub release.

## Known limitations

The following limitations were confirmed at `c254af2f5a4d07c9f1f3b84d6c0226760702bbbb` and are inputs to the production backlog:

1. `SPEC.md` still described the repository as spec-stage even though README and runtime code reported M0-M6 as implemented.
2. The CLI did not implement every command declared by the specification and manifest.
3. `dokion verify` validated repository contracts rather than re-running the configured verification and release gates.
4. `dokion doctor` checked basic local prerequisites but did not fully resolve declared capability versions, digests, conflicts, installer exceptions, or provenance.
5. The capability lock schema existed, but the capability lock was not yet a complete runtime subsystem.
6. Command execution used a POSIX shell through `bash -lc`, inherited the full process environment, buffered stdout and stderr in memory, and did not explicitly terminate complete process trees.
7. Ignored untracked files were outside the repair snapshot boundary unless already represented by tracked or non-ignored state.
8. The runtime had no exclusive run lock, monotonic compare-and-swap state revision, event hash chain, versioned state migration layer, or independent audit command.
9. There was no typed assurance-module lifecycle for application security, supply chain, API contracts, database hardening, observability, reliability, performance, accessibility, AI safety, or mobile-native security.
10. CI primarily exercised Ubuntu and did not yet enforce a supported-host matrix, coverage floors, property tests, mutation tests, or performance budgets.
11. Release version assertions included hardcoded `0.3.0` checks, and release artifacts did not yet include an SBOM or build provenance attestation.
12. Platform guarantees remained weaker outside Claude Code because Codex, Gemini CLI, and ordinary shell execution did not provide the same hook enforcement or native subagent isolation.

## Baseline change rule

Future implementation must not edit this document to make an old baseline appear stronger. When the runtime advances, add a dated progress record or a new audited baseline tied to a new commit. Any production-readiness claim must be derived from current machine evidence, not from this historical inventory.
