# Capability Provenance and Assurance Modules Backlog

## Scope

This workstream proves what executable components were used and introduces typed assurance modules. A catalog entry is descriptive only; execution requires an active playbook declaration and a verified lock entry.

## Task format

Each task is a reviewable delivery unit. P0 blocks public-beta promotion. P1 blocks the broader production-grade claim unless the corresponding surface is explicitly excluded.

## Backlog

### CAP-001 Implement the capability lock runtime

- Priority: P0
- Depends on: None
- Primary files: `src/capabilities/lock-store.ts; schemas/capability-lock.schema.json`
- Verification: `tests/capabilities/lock-store.test.ts`
- Deliverable: Persist resolved identity, version, source, executable path, digest, provenance, installer exception, platform, and verification time in `.dokion/capabilities.lock.json`.
- Acceptance: Lock writes are atomic and schema-valid; stale, future-version, altered, or authority-claiming locks fail closed.

### CAP-002 Resolve declared executables deterministically

- Priority: P0
- Depends on: CAP-001
- Primary files: `src/capabilities/executable-resolver.ts`
- Verification: `tests/capabilities/executable-resolver.test.ts`
- Deliverable: Resolve only the executable declared by the active playbook through an allowed PATH and canonical filesystem rules.
- Acceptance: Ambiguous matches, aliases outside policy, symlink escapes, missing executables, and undeclared fallbacks block before execution.

### CAP-003 Verify capability versions

- Priority: P0
- Depends on: CAP-002
- Primary files: `src/capabilities/version-verifier.ts`
- Verification: `tests/capabilities/version-verifier.test.ts`
- Deliverable: Support exact, range, and command-output version rules without interpreting tool output as instructions.
- Acceptance: Version mismatch, unparsable output, timeout, and conflicting declarations produce stable blocking results.

### CAP-004 Verify immutable digests and pinned Git sources

- Priority: P0
- Depends on: CAP-001
- Primary files: `src/capabilities/digest-verifier.ts; src/capabilities/git-source-verifier.ts`
- Verification: `tests/capabilities/digest-source.test.ts`
- Deliverable: Hash files and directories canonically and verify declared repository URL and commit SHA for Git-backed capabilities.
- Acceptance: Mutable branch-only references, changed files, path-order variation, and source mismatch are rejected with provenance evidence.

### CAP-005 Record package provenance and installer exceptions

- Priority: P0
- Depends on: CAP-001, CAP-003
- Primary files: `src/capabilities/package-provenance.ts; src/capabilities/installer-exception.ts`
- Verification: `tests/capabilities/package-provenance.test.ts`
- Deliverable: Record package manager, registry, package, version, integrity, installer command, exception reason, approval, and verifier without credentials.
- Acceptance: Non-Bun installation is accepted only when explicitly declared and approved; secrets are absent from state, evidence, reports, and logs.

### CAP-006 Validate environment prerequisites without leaking values

- Priority: P0
- Depends on: CAP-001
- Primary files: `src/capabilities/environment-check.ts; src/execution/environment-policy.ts`
- Verification: `tests/capabilities/environment-check.test.ts`
- Deliverable: Check presence and allowed shape of declared variables, pass only declared values to commands, and redact all output and artifacts.
- Acceptance: Dangerous loader variables are denied by default and raw values never appear in repository or release artifacts.

### CAP-007 Detect capability conflicts

- Priority: P0
- Depends on: CAP-001, CAP-002
- Primary files: `src/capabilities/conflict-detector.ts`
- Verification: `tests/capabilities/conflict-detector.test.ts`
- Deliverable: Detect incompatible versions, duplicate responsibility, conflicting write scopes, unsafe parallel declarations, and platform incompatibility.
- Acceptance: Conflicts become deterministic blocking validation results and cannot be resolved by automatic substitution or reordering.

### CAP-008 Expand doctor into a capability audit

- Priority: P0
- Depends on: CAP-001, CAP-007
- Primary files: `src/doctor/run-doctor.ts; src/cli/handlers/doctor.ts`
- Verification: `tests/doctor/doctor.test.ts`
- Deliverable: Report runtime, repository, platform, playbook, state, lock, capability availability, versions, digests, prerequisites, provenance, conflicts, and degradations.
- Acceptance: `dokion doctor` is read-only, deterministic in JSON mode, redacts secrets, and distinguishes blocking failures from warnings.

### MOD-001 Define the assurance module manifest

- Priority: P0
- Depends on: CAP-001
- Primary files: `schemas/dokion-module.schema.json; src/modules/types.ts`
- Verification: `tests/modules/module-schema.test.ts`
- Deliverable: Create a schema for identity, version, responsibility, inputs, outputs, commands, permissions, platforms, findings mapping, and verification contract.
- Acceptance: Incomplete, authority-expanding, floating, or default-enabled modules fail validation.

### MOD-002 Define typed module lifecycle interfaces

- Priority: P0
- Depends on: MOD-001
- Primary files: `src/modules/module.ts; src/modules/context.ts`
- Verification: `tests/modules/lifecycle.test.ts`
- Deliverable: Define prepare, analyze, remediate, verify, and summarize inputs and outputs with explicit context and no implicit global state.
- Acceptance: Each phase is independently testable and cannot access undeclared state, environment, network, or filesystem scope.

### MOD-003 Load modules only from approved capability sources

- Priority: P0
- Depends on: MOD-001, CAP-004
- Primary files: `src/modules/module-loader.ts`
- Verification: `tests/modules/module-loader.test.ts`
- Deliverable: Load a module only when referenced by the active playbook and verified capability lock.
- Acceptance: Unknown local modules and package discovery remain inert; digest or provenance mismatch blocks before lifecycle execution.

### MOD-004 Intersect module permissions with playbook policy

- Priority: P0
- Depends on: MOD-002, MOD-003
- Primary files: `src/modules/permission-mapper.ts; src/policy/permission-policy.ts`
- Verification: `tests/modules/permissions.test.ts`
- Deliverable: Map module requests to the strict intersection of module, playbook, platform, and run policies.
- Acceptance: Any requested expansion blocks before command execution and records the exact denied permission.

### MOD-005 Add a generic local command module adapter

- Priority: P0
- Depends on: MOD-002, MOD-004, EXEC-002
- Primary files: `src/modules/adapters/local-command.ts`
- Verification: `tests/modules/local-command.test.ts`
- Deliverable: Run pinned local binaries through JSON or SARIF contracts and normalize findings and evidence.
- Acceptance: Malformed output, missing artifact, out-of-scope write, timeout, or undeclared command fails without fabricating findings.

### MOD-006 Ship application security assurance modules

- Priority: P0
- Depends on: MOD-005
- Primary files: `modules/application-security/**`
- Verification: `tests/modules/application-security.test.ts`
- Deliverable: Add modules for approved static analysis, secrets review, authorization evidence, injection risks, and security configuration while keeping each tool separately declared.
- Acceptance: Rules retain source provenance, automated and manual coverage remain distinct, and no module executes unless selected by the active playbook.

### MOD-007 Ship supply-chain assurance modules

- Priority: P0
- Depends on: MOD-005
- Primary files: `modules/supply-chain/**`
- Verification: `tests/modules/supply-chain.test.ts`
- Deliverable: Add approved dependency, OSV, secret-scan, license, package-content, SBOM, and container evidence adapters.
- Acceptance: Each tool has a separate lock identity and evidence record; one passing scanner cannot imply another lane passed.

### MOD-008 Ship API and database assurance modules

- Priority: P0
- Depends on: MOD-005
- Primary files: `modules/api-contracts/**; modules/database-hardening/**`
- Verification: `tests/modules/api-database.test.ts`
- Deliverable: Add contract, breaking-change, destructive migration, tenancy, backup, and data-access review adapters.
- Acceptance: Automated results retain manual-review gaps and database-specific unsupported cases remain explicit.

### MOD-009 Ship reliability, performance, and accessibility modules

- Priority: P1
- Depends on: MOD-005
- Primary files: `modules/observability-reliability/**; modules/performance-accessibility/**`
- Verification: `tests/modules/reliability-performance-accessibility.test.ts`
- Deliverable: Add structured logging, redaction, health, timeout, retry, idempotency, benchmark, web-vitals, and accessibility artifact adapters.
- Acceptance: Thresholds are playbook-declared, evidence is reproducible, and automated accessibility never replaces manual review.

### MOD-010 Model AI and mobile coverage gaps explicitly

- Priority: P1
- Depends on: MOD-001, EVID-001
- Primary files: `modules/coverage-declarations/**; src/readiness/coverage.ts`
- Verification: `tests/modules/coverage-declarations.test.ts`
- Deliverable: Provide declarations that prevent AI safety and mobile-native security from appearing covered without assigned modules and evidence.
- Acceptance: Unassigned lanes remain visible with readiness caps, named rationale, and no inferred pass.
