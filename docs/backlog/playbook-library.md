# Built-in and Custom Playbook Library Backlog

## Scope

This workstream makes curated developer-maintained playbooks a first-class product path while preserving user control. Built-in and proposed playbooks are inert until explicit activation creates the active `.dokion/playbook.json`.

## Task format

Each task is a reviewable delivery unit. P0 blocks public-beta promotion. P1 blocks the broader production-grade claim unless the corresponding surface is explicitly excluded.

## Backlog

### PLAY-001 Define the built-in playbook registry contract

- Priority: P0
- Depends on: None
- Primary files: `schemas/dokion-playbook-registry.schema.json; src/playbooks/registry-types.ts`
- Verification: `tests/playbooks/registry-schema.test.ts`
- Deliverable: Create a versioned registry schema containing playbook identity, version, digest, ownership, target profile, compatibility, capability references, coverage, deprecation, and fixture links.
- Acceptance: Unknown fields, floating digests, missing ownership, unsupported targets, and incomplete compatibility declarations fail contract validation.

### PLAY-002 Load the shipped playbook registry deterministically

- Priority: P0
- Depends on: PLAY-001
- Primary files: `src/playbooks/builtin-registry.ts; playbooks/registry.json`
- Verification: `tests/playbooks/builtin-registry.test.ts`
- Deliverable: Load only package-owned registry entries and verify each referenced playbook path, schema, digest, and package boundary.
- Acceptance: Registry order is stable, path traversal and symlink escape fail closed, and local discovery cannot add an executable entry.

### PLAY-003 Add playbook list and inspect commands

- Priority: P0
- Depends on: PLAY-002
- Primary files: `src/cli/handlers/playbooks.ts; src/cli/command-registry.ts`
- Verification: `tests/cli/playbooks.test.ts`
- Deliverable: Implement `dokion playbooks list` and `dokion playbooks show <id>` with human and deterministic JSON output.
- Acceptance: Commands are read-only, show version, digest, coverage, permissions, capabilities, compatibility, and limitations, and never activate a playbook.

### PLAY-004 Copy a built-in playbook to an inert proposal

- Priority: P0
- Depends on: PLAY-002, CORE-002
- Primary files: `src/playbooks/copy-proposal.ts; src/cli/handlers/playbooks.ts`
- Verification: `tests/playbooks/copy-proposal.test.ts`
- Deliverable: Implement explicit copy to `.dokion/playbook.proposed.json` with source metadata and digest, refusing overwrite without a scoped approval.
- Acceptance: The active playbook remains byte-for-byte unchanged and copied content contains no inferred or substituted capability.

### PLAY-005 Implement explicit playbook activation

- Priority: P0
- Depends on: PLAY-004, CORE-002, STATE-001
- Primary files: `src/playbooks/activate-playbook.ts; src/cli/handlers/playbooks.ts`
- Verification: `tests/playbooks/activation.test.ts`
- Deliverable: Validate and atomically activate a selected built-in or proposed custom playbook only after explicit confirmation or an approved input record.
- Acceptance: Activation archives prior active metadata, records actor and source, refuses active-run mutation, and never treats a proposal as executable before activation.

### PLAY-006 Implement guarded proposal configuration

- Priority: P0
- Depends on: PLAY-004
- Primary files: `src/plan/configure-proposal.ts; src/cli/handlers/configure.ts`
- Verification: `tests/cli/configure.test.ts`
- Deliverable: Add `dokion configure` operations that edit only allowed proposal fields and preserve immutable source and authority rules.
- Acceptance: Configuration cannot touch the active playbook, invent capabilities, widen authority fields, or bypass schema and compatibility validation.

### PLAY-007 Harden the web full-stack built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-006, MOD-007
- Primary files: `playbooks/builtin/web-fullstack/**`
- Verification: `tests/playbooks/web-fullstack.test.ts`
- Deliverable: Ship a versioned playbook for frontend, backend, dependencies, API boundaries, data access, reliability, performance, accessibility, tests, and release checks.
- Acceptance: The playbook passes schema and fixture contracts, names manual gaps, pins every capability, and completes its seeded web fixture.

### PLAY-008 Harden the API service built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-006, MOD-008
- Primary files: `playbooks/builtin/api-service/**`
- Verification: `tests/playbooks/api-service.test.ts`
- Deliverable: Ship a versioned API playbook covering contracts, authentication evidence, authorization review, input handling, dependency risk, database safety, observability, and release gates.
- Acceptance: The playbook keeps automated and manual assurance separate and completes its seeded API fixture with expected findings.

### PLAY-009 Harden the library and package built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-007
- Primary files: `playbooks/builtin/library-package/**`
- Verification: `tests/playbooks/library-package.test.ts`
- Deliverable: Ship a versioned library/package playbook covering public API compatibility, tests, dependency risk, package contents, licensing, provenance, and release rollback.
- Acceptance: The playbook blocks on floating capability or package provenance and completes its seeded library fixture.

### PLAY-010 Build the playbook contract harness

- Priority: P0
- Depends on: PLAY-002, PLAY-007, PLAY-008, PLAY-009
- Primary files: `src/playbooks/contract-harness.ts`
- Verification: `tests/playbooks/all-builtins.test.ts`
- Deliverable: Create a reusable test harness that validates authority, dependencies, permissions, digests, coverage, fixture expectations, and deterministic plan output for every shipped playbook.
- Acceptance: Adding a built-in playbook without complete contracts or a passing fixture fails CI.

### PLAY-011 Add playbook version, update, and deprecation policy

- Priority: P1
- Depends on: PLAY-002, PLAY-005
- Primary files: `src/playbooks/version-policy.ts; docs/playbooks/versioning.md`
- Verification: `tests/playbooks/version-policy.test.ts`
- Deliverable: Model compatible updates, breaking revisions, migration notes, end-of-support dates, and digest changes without silent activation.
- Acceptance: Users can inspect available revisions; active projects never upgrade automatically and deprecated versions remain auditable.

### PLAY-012 Document and test custom playbook authoring

- Priority: P0
- Depends on: PLAY-001, PLAY-006, PLAY-010
- Primary files: `docs/playbooks/custom-authoring.md; playbooks/templates/custom.playbook.json`
- Verification: `tests/docs/custom-playbook-smoke.test.ts`
- Deliverable: Provide a minimal custom playbook template, capability pinning guide, permissions guide, validation workflow, and fixture-based authoring test.
- Acceptance: A new user can author, validate, plan, activate, and run a custom playbook without private repository knowledge.
