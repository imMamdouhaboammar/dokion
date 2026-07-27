# Product Experience, Adapters, Distribution, and Launch Backlog

## Scope

This workstream turns the verified engine into an installable and understandable product. Every adapter preserves the same authority model and every public claim is bound to tested release evidence.

## Task format

Each task is a reviewable delivery unit. P0 blocks public-beta promotion. P1 blocks the broader production-grade claim unless the corresponding surface is explicitly excluded.

## Backlog

### PROD-001 Define one canonical adapter contract suite

- Priority: P0
- Depends on: CORE-006, PLAY-003
- Primary files: `src/platform/adapter-contract.ts`
- Verification: `tests/adapters/adapter-contract.test.ts`
- Deliverable: Require Claude Code, Codex, Gemini CLI, and shell surfaces to expose the same skill identity, command registry, authority warnings, output semantics, and active-playbook behavior.
- Acceptance: Adapter-specific metadata cannot add commands, authority, defaults, or capability selection unavailable to the core CLI.

### PROD-002 Complete Claude Code plugin validation

- Priority: P0
- Depends on: PROD-001
- Primary files: `.claude-plugin/**; hooks/hooks.json; .claude/skills/dokion/**`
- Verification: `tests/adapters/claude.test.ts`
- Deliverable: Validate plugin metadata, marketplace files, skill discovery, and guards for every Dokion write-capable operation.
- Acceptance: The guard fails closed during active runs and degrades honestly when hook guarantees are unavailable.

### PROD-003 Complete Codex packaging and guidance

- Priority: P0
- Depends on: PROD-001
- Primary files: `.agents/skills/dokion-hardening/**; .codex/AGENTS.md`
- Verification: `tests/adapters/codex.test.ts`
- Deliverable: Package the canonical skill, repository instructions, command examples, and authority boundaries without adapter-only behavior.
- Acceptance: A clean Codex project discovers Dokion, invokes the installed CLI, and cannot receive hidden capability or execution authority.

### PROD-004 Expose complete Gemini command coverage

- Priority: P0
- Depends on: PROD-001
- Primary files: `commands/dokion/**; gemini-extension.json`
- Verification: `tests/adapters/gemini.test.ts`
- Deliverable: Add namespaced commands for help, doctor, playbooks, plan, validate, run, autopilot, resume, status, findings, step, skip, verify, report, and audit.
- Acceptance: Gemini extension validation passes and command text remains generated or contract-checked against the core registry.

### PROD-005 Negotiate platform guarantees explicitly

- Priority: P0
- Depends on: PROD-001, EXEC-001
- Primary files: `src/platform/guarantees.ts; src/platform/types.ts`
- Verification: `tests/adapters/platform-guarantees.test.ts`
- Deliverable: Record available and missing guarantees for hooks, process control, filesystem semantics, environment isolation, and adapter enforcement.
- Acceptance: A weaker platform cannot silently satisfy a blocking playbook requirement and every degradation appears in plan, status, report, and sign-off.

### PROD-006 Support Windows execution and path rules

- Priority: P1
- Depends on: EXEC-001, EXEC-005, EXEC-006
- Primary files: `src/execution/windows/**; scripts/build-release.ts`
- Verification: `tests/platform/windows.test.ts`
- Deliverable: Implement and test Windows command strategy, process termination, path canonicalization, case behavior, executable resolution, and binary packaging.
- Acceptance: Windows is promoted only after native tests pass; until then it remains explicitly unproven or degraded.

### PROD-007 Run native package and binary smoke matrices

- Priority: P0
- Depends on: PROD-002, PROD-003, PROD-004
- Primary files: `.github/workflows/ci.yml; .github/workflows/release.yml`
- Verification: `tests/distribution/native-smoke.test.ts`
- Deliverable: Install the package and execute release binaries from clean directories on every claimed host and architecture.
- Acceptance: Cross-compilation alone never marks a host tested; failures block the corresponding compatibility claim.

### PROD-008 Prove cross-agent handoff and resume

- Priority: P0
- Depends on: CORE-011, PROD-001, PROD-005
- Primary files: `tests/adapters/cross-agent-resume.test.ts`
- Verification: `tests/adapters/cross-agent-resume.test.ts`
- Deliverable: Start a run under one adapter, pause at approval, resume under another claimed adapter, and reconcile state, lock, events, evidence, and degradations.
- Acceptance: Handoff cannot weaken authority or duplicate side effects and unsupported guarantee changes require review.

### PROD-009 Finish coherent CLI product flows

- Priority: P0
- Depends on: CORE-006, PLAY-003, EVID-010
- Primary files: `src/cli/**; src/cli.ts`
- Verification: `tests/cli/product-flow.test.ts`
- Deliverable: Align help, parsing, JSON output, diagnostics, exit codes, command registry, examples, and status summaries for the complete public-beta surface.
- Acceptance: Unknown options and invalid states return stable codes; stdout contains results, stderr contains diagnostics, and command parity tests cover every adapter.

### PROD-010 Build onboarding, recovery, and limitations documentation

- Priority: P0
- Depends on: PLAY-012, PROD-009
- Primary files: `docs/getting-started/**; docs/operations/**; README.md`
- Verification: `tests/docs/onboarding-smoke.test.ts`
- Deliverable: Document installation, built-in selection, custom authoring, plan, run, approval, resume, verify, audit, recovery, uninstallation, security, and unsupported surfaces.
- Acceptance: Commands are tested from clean fixtures and a new user can complete the beta journey without private knowledge.

### PROD-011 Ship seeded demo repositories

- Priority: P0
- Depends on: CORE-012, PLAY-007, PLAY-008, PLAY-009
- Primary files: `tests/fixtures/promotion/**; examples/**`
- Verification: `tests/acceptance/promotion-fixtures.test.ts`
- Deliverable: Create reproducible web, API, and library fixtures with known defects, fake repairs, approvals, interruptions, and expected evidence.
- Acceptance: Fixtures reset deterministically, avoid network-only dependencies where possible, and remain versioned with expected outcomes.

### PROD-012 Raise required CI quality gates

- Priority: P0
- Depends on: CORE-012, EXEC-010, PROD-007
- Primary files: `.github/workflows/ci.yml; scripts/ci/**`
- Verification: `tests/contracts/ci-gates.test.ts`
- Deliverable: Split contracts, unit, integration, adversarial, recovery, adapters, fixtures, distribution, coverage, property, mutation, performance, and residue checks into required jobs.
- Acceptance: A safety-critical regression cannot merge through an unrelated green aggregate job and job artifacts retain failure evidence.

### PROD-013 Harden release supply-chain evidence

- Priority: P0
- Depends on: PROD-007, PROD-012
- Primary files: `.github/workflows/release.yml; scripts/release/**`
- Verification: `tests/release/release-integrity.test.ts`
- Deliverable: Generate package and binary inventories, checksums, SBOM, version synchronization, provenance attestations where supported, and partial-release rollback checks.
- Acceptance: The exact tagged source maps to inspected artifacts and any incomplete publication blocks promotion sign-off.

### PROD-014 Create the public beta launch checklist

- Priority: P0
- Depends on: EVID-012, PROD-010, PROD-011, PROD-013
- Primary files: `docs/launch/public-beta-checklist.md; SECURITY.md`
- Verification: `tests/contracts/public-beta-checklist.test.ts`
- Deliverable: Define maintainers, defect thresholds, support channel, security disclosure, release notes, demo evidence, compatibility statement, rollback owner, and claim wording.
- Acceptance: Launch cannot proceed with unresolved P0 or P1 defects on promoted surfaces, missing sign-off evidence, or forbidden claims.
