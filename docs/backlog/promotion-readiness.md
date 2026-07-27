# Dokion Promotion Readiness Gate

## Goal

Define the minimum evidence required before Dokion may be publicly promoted as a usable beta, while preserving the stricter production-grade definition in `docs/architecture/production-readiness.md`.

Promotion readiness is not production readiness. It permits a qualified public-beta claim only for the exact package, binaries, agents, operating systems, and playbooks that passed the gate.

## Product promise at public beta

A user can install Dokion, inspect curated built-in playbooks, select or author a playbook, preview the exact execution plan, run a bounded hardening workflow, pause at explicit approval boundaries, resume safely, verify repairs, and inspect evidence-backed results.

The beta promise includes:

- Built-in playbooks maintained by Dokion developers.
- Custom playbooks controlled by the user.
- Deterministic execution of declared stages and steps.
- No automatic capability selection, installation, substitution, or reordering.
- Auditable findings, approvals, repair transactions, evidence, and reports.
- Honest platform and coverage degradations.

## Promotion stages

### Internal alpha

Internal alpha is reached when the primary web, API, and library fixtures complete on the developer-supported host. Failures may require repository knowledge or manual recovery.

### Public beta

Public beta is reached only when every blocking gate in this document passes on one exact release candidate. The release notes must name every excluded or degraded surface.

### Production grade

Production grade remains governed by `docs/architecture/production-readiness.md`. Public beta does not waive Windows, cross-agent, recovery, supply-chain, audit, mutation, property, performance, or provenance requirements that remain blocking for the broader claim.

## Blocking public-beta gates

### PG-001 Authority invariants

All run, resume, step, retry, approval, repair, playbook-selection, and adapter paths prove that undeclared work cannot execute and that `.dokion/playbook.json` is the only active authority.

Evidence:

- Adversarial authority tests.
- Playbook mutation tests.
- Approval bypass tests.
- Inert proposal and recommendation tests.

### PG-002 Deterministic bounded autopilot

The same validated state produces the same next action. Autopilot stops on ambiguity, stale inputs, exhausted budgets, unsupported guarantees, required approvals, or blocking policies.

Evidence:

- Decision-table unit tests.
- Retry and budget tests.
- Dry-run traces.
- End-to-end pause and resume fixture.

### PG-003 Curated built-in playbook library

Dokion ships at least three versioned built-in playbooks for web full-stack, API service, and library/package projects. Each playbook has ownership, compatibility, capability pins, permissions, acceptance fixtures, and a documented coverage statement.

Evidence:

- Registry schema and digest validation.
- Playbook contract tests.
- Seeded fixture results.
- Deprecation and upgrade behavior tests.

### PG-004 Safe custom playbooks

Users can validate, inspect, copy, edit, and explicitly activate custom playbooks without Dokion inventing capabilities or silently mutating the active playbook.

Evidence:

- Proposal and activation boundary tests.
- Unknown capability rejection.
- Permission expansion rejection.
- Active playbook immutability tests.

### PG-005 Capability provenance

Every executable capability used by a promoted playbook resolves to a recorded source, version, canonical path, immutable digest, and verification result. Missing, ambiguous, floating, or conflicting capabilities block execution.

Evidence:

- Capability lock fixture.
- Executable resolution tests.
- Version, digest, and Git source tests.
- Environment value redaction tests.

### PG-006 Crash-safe state and recovery

A second live run cannot enter the same project. State revisions, event records, checkpoints, and repair transactions survive interruption and resume without silent loss or duplicate side effects.

Evidence:

- Run-lock tests.
- Atomic write recovery tests.
- Signal interruption tests.
- Stale-run and repository-identity tests.

### PG-007 Contained command and repair execution

Commands use declared platform strategies, bounded environments, output limits, timeouts, process-tree termination, canonical paths, approved write scopes, and exact rollback where supported.

Evidence:

- Argument-vector and shell risk tests.
- Symlink, traversal, Unicode, and case tests.
- Large-output and timeout tests.
- Binary, ignored-file, and rollback tests.

### PG-008 Evidence-backed audit and reporting

Reports reconcile the active playbook, capability lock, repository identity, state, events, findings, evidence, repair transactions, gates, coverage, skips, and degradations.

Evidence:

- Evidence manifest and checksum verification.
- Independent `dokion audit` result.
- Deterministic JSON report.
- SARIF or JUnit export for CI integration.

### PG-009 Supported install and execution paths

The exact release package and promoted standalone binaries install and execute from clean directories. The promoted host and agent matrix is green, and unsupported surfaces are labeled rather than implied.

Evidence:

- Clean Bun package installation.
- Standalone binary smoke tests.
- Claude Code, Codex, Gemini CLI, and shell adapter contract results for claimed surfaces.
- Compatibility matrix generated from release evidence.

### PG-010 Seeded product journeys

The web, API, and library demo repositories contain known findings, approval boundaries, safe repairs, fake repairs, interrupted runs, and coverage gaps. Each journey finishes with a reconciled report.

Evidence:

- Repeatable fixture setup.
- Recorded expected findings.
- Fake-fix rejection.
- Pause, approval, resume, and completion flow.

### PG-011 Operational documentation

A new user can install, choose a built-in playbook, use a custom playbook, inspect a plan, run, approve, resume, verify, audit, recover, and uninstall using current documentation only.

Evidence:

- Documentation smoke test.
- Copy-paste command verification.
- Troubleshooting and recovery drills.
- Security and limitations review.

### PG-012 Release integrity and launch sign-off

The release candidate has synchronized versions, checksums, artifact inventory, SBOM, provenance where supported, release notes, rollback instructions, and no unresolved P0 or P1 defect for the promoted surface.

Evidence:

- Protected release workflow.
- Artifact inspection.
- Security sign-off.
- Maintainer promotion checklist.

## Required beta journeys

1. Select the built-in web full-stack playbook, inspect it, activate it, run it, approve one repair, reject one fake repair, resume, verify, and audit.
2. Copy the built-in API playbook to a proposed custom playbook, make an allowed edit, validate it, explicitly activate it, and complete the run.
3. Run the library/package playbook with a missing declared capability and prove that Dokion blocks instead of substituting another tool.
4. Interrupt a write-capable run, restart on the same repository, classify staleness, and resume without duplicate mutation.
5. Move a paused run between two claimed agent adapters and prove that authority and evidence remain consistent.

## Allowed public claims

- Dokion is a bounded software-hardening runtime in public beta.
- Dokion ships curated built-in playbooks and supports user-controlled custom playbooks.
- Dokion executes only declared capabilities and records evidence for its scoped results.
- Dokion can verify and roll back supported repairs that fail declared validation.

## Forbidden public claims

- Fully autonomous security engineer.
- Automatically makes any repository production ready.
- Guarantees security, compliance, accessibility, reliability, or performance.
- Supports every operating system, agent, language, or repository.
- Installs or selects the best tools automatically.
- Fixes every finding without review.

## Promotion sign-off record

The release record must include:

- Release version, commit, tag, package digest, and binary digests.
- Passed and excluded operating systems, agents, package modes, and binary modes.
- Built-in playbook versions and digests.
- Capability lock and module versions used by acceptance fixtures.
- CI, security, audit, fixture, package, and release workflow links.
- Open defects, accepted limitations, and expiry or revalidation date.
- Maintainer and security reviewer identities.

No promotion-ready checkbox may be marked complete without this record.
