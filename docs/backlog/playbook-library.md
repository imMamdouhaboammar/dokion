# Built-in and Custom Playbook Library Backlog

## Scope

Make curated developer-maintained playbooks a first-class product path while preserving user control. Built-in and proposed playbooks remain inert until explicit activation creates the active `.dokion/playbook.json`.

P0 blocks public-beta promotion. P1 blocks a broader production-grade claim unless the surface is explicitly excluded.

## Backlog

### PLAY-001 Define the built-in playbook registry contract

- Priority: P0
- Depends on: CAP-001
- Primary files: `schemas/dokion-playbook-registry.schema.json`, `src/playbooks/registry-types.ts`
- Verification: `tests/playbooks/registry-schema.test.ts`
- Deliverable: A versioned registry schema with identity, version, digest, ownership, target profile, compatibility, capabilities, coverage, deprecation, and fixture links.
- Acceptance: Floating digests, missing ownership, unsupported targets, and incomplete compatibility declarations fail validation.

### PLAY-002 Load the shipped registry deterministically

- Priority: P0
- Depends on: PLAY-001
- Primary files: `src/playbooks/builtin-registry.ts`, `playbooks/registry.json`
- Verification: `tests/playbooks/builtin-registry.test.ts`
- Deliverable: A package-owned loader that verifies every referenced path, schema, digest, and package boundary.
- Acceptance: Registry order is stable. Path traversal, symlink escape, missing files, and local discovery fail closed.

### PLAY-003 Add playbook list and inspect commands

- Priority: P0
- Depends on: PLAY-002
- Primary files: `src/cli/handlers/playbooks.ts`, `src/cli/command-registry.ts`
- Verification: `tests/cli/playbooks.test.ts`
- Deliverable: `dokion playbooks list` and `dokion playbooks show <id>` in human and deterministic JSON formats.
- Acceptance: Commands are read-only and show version, digest, coverage, permissions, capabilities, compatibility, ownership, and limitations.

### PLAY-004 Copy a built-in playbook to an inert proposal

- Priority: P0
- Depends on: PLAY-002, CORE-002
- Primary files: `src/playbooks/copy-proposal.ts`, `src/cli/handlers/playbooks.ts`
- Verification: `tests/playbooks/copy-proposal.test.ts`
- Deliverable: Explicit copy to `.dokion/playbook.proposed.json` with source metadata and digest.
- Acceptance: The active playbook remains unchanged, overwrite requires scoped approval, and no capability is inferred or substituted.

### PLAY-005 Implement explicit playbook activation

- Priority: P0
- Depends on: PLAY-004, CORE-002, STATE-001
- Primary files: `src/playbooks/activate-playbook.ts`, `src/cli/handlers/playbooks.ts`
- Verification: `tests/playbooks/activation.test.ts`
- Deliverable: Atomically activate a validated built-in or proposed custom playbook after explicit confirmation or approved input.
- Acceptance: Active-run mutation is refused, prior metadata is archived, actor and source are recorded, and proposals are never executable before activation.

### PLAY-006 Implement guarded proposal configuration

- Priority: P0
- Depends on: PLAY-004
- Primary files: `src/plan/configure-proposal.ts`, `src/cli/handlers/configure.ts`
- Verification: `tests/cli/configure.test.ts`
- Deliverable: `dokion configure` edits only allowed proposal fields and preserves immutable source and authority rules.
- Acceptance: Configuration cannot touch the active playbook, invent capabilities, widen authority, or bypass schema and compatibility checks.

### PLAY-007 Harden the web full-stack built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-006, MOD-007
- Primary files: `playbooks/builtin/web-fullstack/**`
- Verification: `tests/playbooks/web-fullstack.test.ts`
- Deliverable: A versioned playbook for frontend, backend, dependencies, API boundaries, data access, reliability, performance, accessibility, tests, and release checks.
- Acceptance: Every capability is pinned, manual gaps are named, permissions are bounded, and the seeded web fixture completes.

### PLAY-008 Harden the API service built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-006, MOD-008
- Primary files: `playbooks/builtin/api-service/**`
- Verification: `tests/playbooks/api-service.test.ts`
- Deliverable: A versioned API playbook covering contracts, authentication evidence, authorization review, inputs, dependency risk, database safety, observability, and release gates.
- Acceptance: Automated and manual assurance remain separate and the seeded API fixture produces the expected findings and gaps.

### PLAY-009 Harden the library and package built-in playbook

- Priority: P0
- Depends on: MOD-005, MOD-007
- Primary files: `playbooks/builtin/library-package/**`
- Verification: `tests/playbooks/library-package.test.ts`
- Deliverable: A versioned playbook covering public API compatibility, tests, dependency risk, package contents, licensing, provenance, and release rollback.
- Acceptance: Floating capability or package provenance blocks execution and the seeded library fixture completes.

### PLAY-010 Build the playbook contract harness

- Priority: P0
- Depends on: PLAY-002, PLAY-007, PLAY-008, PLAY-009
- Primary files: `src/playbooks/contract-harness.ts`
- Verification: `tests/playbooks/all-builtins.test.ts`
- Deliverable: Reusable validation for authority, dependencies, permissions, digests, coverage, fixture expectations, and deterministic plan output.
- Acceptance: Adding a built-in playbook without complete contracts or a passing fixture fails CI.

### PLAY-011 Add version, update, and deprecation policy

- Priority: P1
- Depends on: PLAY-002, PLAY-005
- Primary files: `src/playbooks/version-policy.ts`, `docs/playbooks/versioning.md`
- Verification: `tests/playbooks/version-policy.test.ts`
- Deliverable: Compatible updates, breaking revisions, migration notes, support dates, and digest changes without silent activation.
- Acceptance: Users can inspect revisions, active projects never auto-upgrade, and deprecated versions remain auditable.

### PLAY-012 Document and test custom playbook authoring

- Priority: P0
- Depends on: PLAY-001, PLAY-006, PLAY-010
- Primary files: `docs/playbooks/custom-authoring.md`, `playbooks/templates/custom.playbook.json`
- Verification: `tests/docs/custom-playbook-smoke.test.ts`
- Deliverable: A custom template, capability pinning guide, permission guide, validation flow, and fixture-based authoring test.
- Acceptance: A new user can author, validate, plan, activate, and run a custom playbook without private repository knowledge.
