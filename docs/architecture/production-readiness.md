# Dokion Production Readiness Definition

## Purpose

This document defines what the production-grade backlog is allowed to claim. It separates the readiness of the Dokion product from the scoped result Dokion produces for another repository.

No unqualified production-ready claim is valid.

A claim must identify the subject, exact commit, configuration, evidence, tested environments, known degradations, open gaps, and time of verification.

## Two distinct readiness subjects

### Dokion runtime production readiness

This is a claim about the Dokion repository, package, compiled binaries, adapters, schemas, state model, evidence model, CI, and release process.

Dokion runtime production readiness requires the product itself to pass the proof lanes and release gates defined below against the exact shipping commit. It is not achieved merely because the CLI runs or because one fixture completes.

### Target repository scoped readiness

This is a claim about one target repository at one exact commit under one user-approved `.dokion/playbook.json`, one resolved capability lock, one set of platform guarantees, and one recorded evidence set.

Target repository scoped readiness reports what the configured process proved, what it did not run, what remains open, what was accepted or deferred, and which guarantees were weaker than requested.

A successful target run does not prove Dokion runtime production readiness. A production-ready Dokion release does not prove a target repository is safe. Readiness does not transfer between these subjects.

## Claim grammar

Every valid readiness statement answers:

1. What subject is being evaluated?
2. Which exact source commit or immutable artifact is covered?
3. Which playbook, schemas, capability lock, and policy versions were used?
4. Which operating systems, agents, package mode, and binary mode were tested?
5. Which proof lanes and release gates passed?
6. Which evidence artifacts and digests support the result?
7. Which steps were skipped, blocked, manually reviewed, or not applicable?
8. Which findings remain open, accepted, deferred, or unverifiable?
9. Which platform degradations and coverage gaps were present?
10. When did the evidence become stale or require revalidation?

A statement that omits material qualifiers is a report defect.

## Dokion production-grade proof lanes

All lanes are blocking for a general Dokion runtime production-readiness claim unless a narrower release claim explicitly excludes a surface.

### 1. authority and policy safety

The active playbook remains the only execution authority. Undeclared capabilities never execute. Approvals are typed and scoped. Precedence, applicability, failure policy, retries, stops, recommendations, and bounded autopilot cannot enlarge authority.

Required proof includes adversarial tests for prompt injection, stale approvals, undeclared capability invocation, policy conflicts, playbook mutation, proposal activation, and cross-agent handoff.

### 2. state and recovery integrity

State, events, approvals, findings, evidence references, repair transactions, and completion criteria survive interruption without ambiguity or silent loss.

Required proof includes atomic writes, monotonic revisions, exclusive run locks, event integrity, versioned migrations, stale-run detection, signal handling, crash recovery, and deterministic resume from disk.

### 3. command and repair containment

External commands execute through explicit platform strategies, bounded environments, timeouts, output limits, process-tree termination, canonical paths, approved write scopes, and verified rollback boundaries.

Required proof includes shell and argument-vector cases, hostile paths, symlinks, Unicode and case-folding behavior, ignored files, binary files, oversized files, suppression attempts, deleted tests, and failed rollback scenarios.

### 4. evidence and auditability

Every success claim reconciles against immutable or integrity-checked machine evidence. Reports are derived from state and evidence, not model assertions.

Required proof includes schema-valid events and reports, evidence manifests, checksums, deterministic exports, journal reconciliation, independent audit, report regeneration, and comparison between runs.

### 5. cross-platform and cross-agent behavior

Linux, macOS, and Windows behavior is tested for the surfaces claimed by the release. Claude Code, Codex, Gemini CLI, and ordinary shell adapters preserve the same authority contract and report their real degradations.

Required proof includes package installs, standalone binaries, path behavior, process control, adapter discovery, command parity, guarantee negotiation, and cross-agent resume.

### 6. distribution and supply-chain integrity

The exact package archive and every release binary are built from the tagged commit, inspected, smoke-tested, inventoried, and accompanied by integrity and provenance material.

Required proof includes frozen dependencies, pinned CI actions, secret and private-path rejection, exact package allowlists, checksums, SBOM, build provenance, version synchronization, immutable publication, and partial-release failure handling.

### 7. seeded-fixture acceptance

Representative web, API, and library fixture repositories contain known defects and adversarial repair attempts. Dokion must find configured defects, reject fake fixes, recover interruptions, obey approvals, preserve scope, and reconcile the final report.

Fixture success is necessary but not sufficient. Fixtures must cover authority failures and evidence failures, not only ordinary scanner output.

### 8. operational documentation

Installation, configuration, authority boundaries, recovery, incident response, release, rollback, compatibility, limitations, and audit procedures are documented and tested against current behavior.

Documentation must distinguish implemented behavior from planned behavior and must not depend on private machine paths, unstated credentials, or tribal knowledge.

## Required release gates for Dokion

A release claiming Dokion runtime production readiness must pass all applicable gates on the exact release commit:

- Schema and contract conformance.
- Complete unit, integration, adversarial, property, mutation, recovery, and acceptance tests.
- Strict TypeScript checking and compiled build validation.
- Linux, macOS, and Windows host or binary smoke tests for claimed targets.
- Package archive inspection and clean installation from the produced tarball.
- Standalone binary execution from empty directories.
- Claude Code, Codex, and Gemini adapter contract validation.
- Security, dependency, secret, license, and workflow-permission checks.
- Coverage and performance budgets for safety-critical paths.
- Evidence audit and source-tree residue checks.
- Version, tag, package, adapter, binary, and release-note synchronization.
- SBOM, checksums, artifact inventory, and build provenance.
- Seeded-fixture acceptance for the release candidate.

A skipped blocking gate prevents the general claim. A narrower claim must name the excluded surface and must not use general production-ready wording.

## Target repository readiness states

A target report may use only readiness terms defined by the approved playbook and evaluated from its configured gates. Regardless of vocabulary, the report must preserve these distinctions:

- Required declared work passed with evidence.
- Work passed but material conditions, manual reviews, or acknowledged gaps remain.
- Blocking findings, gates, approvals, evidence, dependencies, or coverage assignments remain unresolved.
- The run is stale, tainted, interrupted, or otherwise not comparable with the current repository state.

Only findings in the configured verified state count toward release gates. Fixed-but-unverified, accepted risk, deferred, blocked, false-positive, and not-applicable outcomes remain separately visible.

## Scope and evidence freshness

Readiness is invalidated or requires explicit revalidation when a material input changes, including:

- target source commit or repository identity
- active playbook content or digest
- capability version, digest, source, or lock
- schema or policy version
- platform guarantee or adapter version
- dependency graph or release artifact
- approval scope or expiration
- evidence integrity or retention
- manual review assumptions

Historical reports remain records of the earlier run but do not automatically cover later commits.

## Forbidden claims

Dokion, its adapters, release automation, documentation, and generated reports must not state or imply:

- that a repository is secure because no configured finding was produced
- that unassigned or unexecuted coverage lanes passed
- that automated accessibility or authorization scanning replaced required manual review
- that accepted risk or deferred work was remediated
- that a repair succeeded without verification and adversarial validation
- that a package or binary is reproducible without the evidence required by the declared release policy
- that all agents provide equivalent enforcement
- that a successful run authorizes commit, merge, release, publication, or deployment
- that production readiness is permanent

## Exit criteria for the production-grade backlog

The 100-commit backlog reaches its runtime objective only when:

1. Every backlog item is merged as a traceable, independently reviewed main-branch commit.
2. Safety-critical tests and contracts pass on the exact candidate commit.
3. Supported platform and adapter matrices are green for the surfaces claimed.
4. Package and standalone binary modes pass clean-environment validation.
5. Bounded autopilot passes authority, approval, budget, stale-state, interruption, and adversarial scenarios.
6. Repair validation catches suppression, scope expansion, test weakening, and incomplete repairs, then restores exact prior state.
7. Capability provenance, lock integrity, state integrity, event integrity, evidence integrity, and report reconciliation are independently auditable.
8. Release artifacts include package inventory, binary inventory, checksums, SBOM, and provenance.
9. Operational, security, compatibility, release, recovery, and limitation documentation matches tested behavior.
10. No unresolved blocking defect or unacknowledged blocking lane remains for the claimed Dokion release surface.

Meeting these criteria permits a qualified claim about that Dokion release candidate. It does not transfer to repositories evaluated by Dokion.

## Examples

### Valid Dokion runtime statement

Dokion version X at commit Y passed the declared production acceptance workflow for the listed package, binary, operating-system, and adapter surfaces. The statement links the evidence manifest, release artifacts, known limitations, and any excluded surfaces.

### Valid target repository statement

Repository R at commit C satisfied the release gates in playbook digest P using capability lock L on platform A. The report lists verified findings, open and accepted findings, skipped work, manual reviews, degradations, and uncovered lanes.

### Invalid statement

"This repository is production ready."

The subject, configuration, evidence, scope, gaps, environment, and tested commit are absent, so the statement is not permitted.
