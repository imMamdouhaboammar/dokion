# Dokion Promotion-Ready Build Tasks

## Objective

Build Dokion from the current runtime baseline into a product that may be promoted honestly as a bounded software-hardening runtime in public beta, then continue to the stricter production-grade gate.

Dokion supports two first-class playbook paths:

1. Curated built-in playbooks shipped and maintained by Dokion developers.
2. Custom playbooks authored or adapted by users.

Neither path is active until the user explicitly selects and activates a playbook. `.dokion/playbook.json` remains the sole execution authority.

## Status rules

- `[ ]` Not started or not yet proven against the task acceptance criteria.
- `[~]` In progress on a branch or pull request.
- `[x]` Merged to `main` with required verification evidence.
- P0 blocks public-beta promotion.
- P1 blocks the broader production-grade claim unless the related surface is explicitly excluded.
- A task is complete only when code, tests, contracts, documentation, and rollback behavior agree.

## Planning foundation

- [x] Define the qualified public-beta promotion gate.
- [x] Separate built-in and custom playbook product paths.
- [x] Publish six detailed engineering workstreams.
- [x] Define stable task IDs, dependencies, primary files, verification paths, deliverables, and acceptance criteria.

## Promotion gates

No release may be marked promotion-ready until all applicable gates below are backed by an exact release-candidate sign-off record.

- [x] **PG-001** Authority invariants (`.dokion/playbook.json` is sole execution authority)
- [x] **PG-002** Deterministic bounded autopilot (Dry-run, approval policy, run budgets, step execution)
- [x] **PG-003** Curated built-in playbook library (Web fullstack, API service, library package)
- [x] **PG-004** Safe custom playbooks (Proposal, configuration, validation, activation)
- [x] **PG-005** Capability provenance (Lock runtime, executable resolution, digests, package provenance)
- [x] **PG-006** Crash-safe state and recovery (Locking, monotonic revisions, event chain, signal recovery)
- [x] **PG-007** Contained command and repair execution (Argument-vector specs, output spooling, path policy, repair transactions)
- [x] **PG-008** Evidence-backed audit and reporting (Completion criteria, readiness statement, evidence manifests, JSON report, audit)
- [x] **PG-009** Supported install and execution paths (Bun, native binaries, distribution archive)
- [x] **PG-010** Seeded product journeys (Promotion fixtures for web, API, library)
- [x] **PG-011** Operational documentation (Onboarding, recovery, limitations, threat model)
- [x] **PG-012** Release integrity and launch sign-off (Promotion sign-off record, release checksums, public launch checklist)

## Recommended execution order

1. State revisions, event integrity, run locking, repository identity, and capability provenance.
2. Deterministic decision policies, approvals, failure behavior, retries, budgets, and secure execution.
3. Built-in playbook registry, activation boundary, module lifecycle, and the first three curated playbooks.
4. Evidence manifests, qualified reports, independent audit, and bounded-autopilot end-to-end acceptance.
5. Adapter parity, clean-install matrices, seeded product journeys, CI gates, release evidence, and launch sign-off.

The dependency graph in `docs/backlog/` is authoritative when this recommended order and an individual dependency differ.

## Core runtime and bounded autopilot

Detailed acceptance criteria: `docs/backlog/core-autopilot.md`.

- [x] **CORE-001** Build deterministic next-action selection · P0
- [x] **CORE-002** Centralize approval boundary evaluation · P0
- [x] **CORE-003** Complete failure policy transitions · P0
- [x] **CORE-004** Add bounded retry scheduling · P0
- [x] **CORE-005** Enforce run budgets · P0
- [x] **CORE-006** Implement the autopilot command · P0
- [x] **CORE-007** Add dry-run decision traces · P0
- [x] **CORE-008** Implement guarded single-step execution · P0
- [x] **CORE-009** Implement auditable skip decisions · P0
- [x] **CORE-010** Make verify re-run configured gates · P0
- [x] **CORE-011** Classify stale runs before resume · P0
- [x] **CORE-012** Prove bounded autopilot end to end · P0

## Built-in and custom playbook library

Detailed acceptance criteria: `docs/backlog/playbook-library.md`.

- [x] **PLAY-001** Define the built-in playbook registry contract · P0
- [x] **PLAY-002** Load the shipped registry deterministically · P0
- [x] **PLAY-003** Add playbook list and inspect commands · P0
- [x] **PLAY-004** Copy a built-in playbook to an inert proposal · P0
- [x] **PLAY-005** Implement explicit playbook activation · P0
- [x] **PLAY-006** Implement guarded proposal configuration · P0
- [x] **PLAY-007** Harden the web full-stack built-in playbook · P0
- [x] **PLAY-008** Harden the API service built-in playbook · P0
- [x] **PLAY-009** Harden the library and package built-in playbook · P0
- [x] **PLAY-010** Build the playbook contract harness · P0
- [x] **PLAY-011** Add version, update, and deprecation policy · P1
- [x] **PLAY-012** Document and test custom playbook authoring · P0

## Capability provenance

Detailed acceptance criteria: `docs/backlog/capability-modules.md`.

- [x] **CAP-001** Implement the capability lock runtime · P0
- [x] **CAP-002** Resolve declared executables deterministically · P0
- [x] **CAP-003** Verify capability versions · P0
- [x] **CAP-004** Verify immutable digests and pinned Git sources · P0
- [x] **CAP-005** Record package provenance and installer exceptions · P0
- [x] **CAP-006** Validate environment prerequisites without leaking values · P0
- [x] **CAP-007** Detect capability conflicts · P0
- [x] **CAP-008** Expand doctor into a capability audit · P0

## Assurance modules

Detailed acceptance criteria: `docs/backlog/capability-modules.md`.

- [x] **MOD-001** Define the assurance module manifest · P0
- [x] **MOD-002** Define typed module lifecycle interfaces · P0
- [x] **MOD-003** Load modules only from approved capability sources · P0
- [x] **MOD-004** Intersect module permissions with playbook policy · P0
- [x] **MOD-005** Add a generic local command module adapter · P0
- [x] **MOD-006** Ship application security assurance modules · P0
- [x] **MOD-007** Ship supply-chain assurance modules · P0
- [x] **MOD-008** Ship API and database assurance modules · P0
- [x] **MOD-009** Ship reliability, performance, and accessibility modules · P1
  - [x] Implement observability & reliability adapters (structured logging, health, timeouts, retries, idempotency)
  - [x] Implement performance & accessibility adapters (Core Web Vitals, WCAG benchmarks)
  - [x] Add unit test suite `tests/modules/reliability-performance-accessibility.test.ts`
- [x] **MOD-010** Model AI and mobile coverage gaps explicitly · P1
  - [x] Create AI safety & mobile security gap declaration models in `modules/coverage-declarations/`
  - [x] Update `src/readiness/coverage.ts` to reflect explicit gap modeling with readiness score caps
  - [x] Add unit test suite `tests/modules/coverage-declarations.test.ts`

## State integrity and recovery

Detailed acceptance criteria: `docs/backlog/state-execution-security.md`.

- [x] **STATE-001** Add exclusive project run locking · P0
- [x] **STATE-002** Add monotonic revisions and compare-and-swap · P0
- [x] **STATE-003** Validate typed event records · P0
- [x] **STATE-004** Hash-chain the append-only event journal · P0
- [x] **STATE-005** Recover interrupted atomic writes · P0
- [x] **STATE-006** Bind runs to repository identity · P0
- [x] **STATE-007** Enforce declared dirty-worktree policy · P0
- [x] **STATE-008** Handle termination signals safely · P0
- [x] **STATE-009** Checkpoint every external side effect · P0
- [x] **STATE-010** Add versioned state migrations · P1

## Secure command and repair execution

Detailed acceptance criteria: `docs/backlog/state-execution-security.md`.

- [x] **EXEC-001** Add platform command strategies · P0
- [x] **EXEC-002** Support argument-vector commands · P0
- [x] **EXEC-003** Restrict command environments · P0
- [x] **EXEC-004** Spool bounded command output · P0
- [x] **EXEC-005** Terminate complete process trees · P0
- [x] **EXEC-006** Canonicalize every read and write scope · P0
- [x] **EXEC-007** Cover bounded ignored files in repair snapshots · P0
- [x] **EXEC-008** Handle binary and large repair files · P0
- [x] **EXEC-009** Persist repair transaction manifests · P0
- [x] **EXEC-010** Fuzz repair and scope boundaries · P1

## Evidence, audit, reporting, and readiness

Detailed acceptance criteria: `docs/backlog/evidence-audit-readiness.md`.

- [x] **EVID-001** Evaluate every completion criterion · P0
- [x] **EVID-002** Centralize qualified readiness statements · P0
- [x] **EVID-003** Report declared execution and used capabilities · P0
- [x] **EVID-004** Report exceptions and unapplied work · P0
- [x] **EVID-005** Add a versioned deterministic JSON report · P0
- [x] **EVID-006** Add SARIF export · P1
- [x] **EVID-007** Add JUnit verification export · P1
- [x] **EVID-008** Build evidence manifests and checksums · P0
- [x] **EVID-009** Compare two Dokion runs (`dokion compare`/`diff`) · P1
  - [x] Implement run record comparison logic in `src/report/compare-runs.ts`
  - [x] Implement CLI handler `src/cli/handlers/compare.ts` and register command
  - [x] Add unit test suite `tests/report/compare-runs.test.ts`
- [x] **EVID-010** Add an independent audit command · P0
- [x] **EVID-011** Define evidence retention and export bundles · P1
  - [x] Implement retention classes and pruning rules in `src/evidence/retention.ts`
  - [x] Implement bundle export and import verifier in `src/export/run-bundle.ts`
  - [x] Add unit test suite `tests/evidence/retention-export.test.ts`
- [x] **EVID-012** Generate the promotion sign-off record · P0
  - [x] Define JSON schema `schemas/dokion-promotion-signoff.schema.json`
  - [x] Implement record generator `src/readiness/promotion-signoff.ts` with cryptographic digests
  - [x] Add unit test suite `tests/readiness/promotion-signoff.test.ts`

## Product experience, adapters, distribution, and launch

Detailed acceptance criteria: `docs/backlog/product-distribution.md`.

- [x] **PROD-001** Define one canonical adapter contract suite · P0
  - [x] Implement adapter contract interface in `src/platform/adapter-contract.ts`
  - [x] Add test suite `tests/adapters/adapter-contract.test.ts`
- [x] **PROD-002** Complete Claude Code plugin validation · P0
  - [x] Validate Claude plugin hooks and skills in `tests/adapters/claude.test.ts`
- [x] **PROD-003** Complete Codex packaging and guidance · P0
  - [x] Validate Codex skill instructions and CLI invocation in `tests/adapters/codex.test.ts`
- [x] **PROD-004** Expose complete Gemini command coverage · P0
  - [x] Register and validate complete Gemini extension commands in `tests/adapters/gemini.test.ts`
- [x] **PROD-005** Negotiate platform guarantees explicitly · P0
  - [x] Implement guarantee negotiator in `src/platform/guarantees.ts`
  - [x] Add test suite `tests/adapters/platform-guarantees.test.ts`
- [x] **PROD-006** Support Windows execution and path rules · P1
  - [x] Implement Windows command strategy and path canonicalizer in `src/execution/windows/`
  - [x] Add test suite `tests/platform/windows.test.ts`
- [x] **PROD-007** Run native package and binary smoke matrices · P0
  - [x] Implement package and binary smoke test in `tests/distribution/native-smoke.test.ts`
- [x] **PROD-008** Prove cross-agent handoff and resume · P0
  - [x] Implement cross-agent resume test suite in `tests/adapters/cross-agent-resume.test.ts`
- [x] **PROD-009** Finish coherent CLI product flows · P0
  - [x] Verify CLI options, JSON output, exit codes, and diagnostics in `tests/cli/product-flow.test.ts`
- [x] **PROD-010** Build onboarding, recovery, and limitations documentation · P0
  - [x] Create onboarding & operational docs in `docs/getting-started/` and `docs/operations/`
  - [x] Add test suite `tests/docs/onboarding-smoke.test.ts`
- [x] **PROD-011** Ship seeded demo repositories · P0
  - [x] Create promotion fixtures in `tests/fixtures/promotion/` for web, API, and library
  - [x] Add test suite `tests/acceptance/promotion-fixtures.test.ts`
- [x] **PROD-012** Raise required CI quality gates · P0
  - [x] Validate CI workflow gates in `tests/contracts/ci-gates.test.ts`
- [x] **PROD-013** Harden release supply-chain evidence · P0
  - [x] Validate release integrity and supply-chain evidence in `tests/release/release-integrity.test.ts`
- [x] **PROD-014** Create the public beta launch checklist · P0
  - [x] Create launch checklist in `docs/launch/public-beta-checklist.md`
  - [x] Add test suite `tests/contracts/public-beta-checklist.test.ts`

## Promotion-ready completion rule

Dokion may be promoted as a public beta only when:

1. Every P0 task applicable to the claimed surface is merged and traceable.
2. PG-001 through PG-012 have machine and human review evidence for the exact release candidate.
3. The built-in web, API, and library journeys pass from clean fixtures.
4. The custom playbook journey proves explicit proposal, validation, activation, execution, and audit boundaries.
5. No unresolved P0 or P1 defect remains on a promoted surface.
6. Package, binaries, adapters, playbook versions, capability locks, evidence, compatibility claims, and release notes are synchronized.
7. `dokion audit` passes and a promotion sign-off record is generated.
8. Public wording remains within the allowed claims in `docs/backlog/promotion-readiness.md`.

