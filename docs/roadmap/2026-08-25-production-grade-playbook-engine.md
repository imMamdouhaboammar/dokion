# Dokion Production-Grade Playbook Engine Roadmap

Date: 2026-08-25

Repository baseline inspected: `c6ab6fdd436b329393d4bd34c1d9d70487941b46`

Status: Execution roadmap for the next production-grade line. This document does not claim the current repository is production ready.

## 1. Product definition

Dokion is not a Skill runner.

A Skill is one capability with a focused responsibility. A Dokion Playbook is a broader execution contract that can coordinate multiple Skills, plugins, agents, subagents, MCP servers, tools, and commands across a long-running engineering process.

A Playbook may define, for example:

```text
inspect repository
  -> architecture analysis Skill
  -> security scanning Skills
  -> test-generation Skill
  -> remediation Skill
  -> independent verification Skill
  -> release checks
  -> evidence and sign-off
```

Dokion is the execution-control engine around that Playbook.

Its job is to make a capable agent follow the declared Playbook end to end while preserving:

- exact stage and step order
- declared dependencies
- capability identity and version
- explicit permissions
- approval boundaries
- bounded retries and iteration limits
- durable checkpoints
- typed handoffs between steps
- repository and Playbook identity
- evidence for every material decision
- verification and release gates
- recovery after interruption
- clear failure, blocked, stale, and tainted states

The intended product promise is:

> Give Dokion an approved Playbook. Dokion coordinates the declared capabilities, keeps the agent inside the contract, records what happened, and refuses to claim completion when the Playbook was not satisfied.

The production claim must remain bounded by the actual host guarantees. Dokion can strongly control actions that are mediated through its runtime. It must not claim that an external agent cannot act outside Dokion when the host provides no enforcement hook capable of preventing that behavior.

## 2. Current-state assessment

The repository already contains a substantial runtime. The next stage is not a rewrite.

Strong existing foundations include:

- `.dokion/playbook.json` as sole execution authority
- deterministic stage and step execution
- capability references for Skill, plugin, agent, subagent, MCP server, tool, and command types
- immutable Playbook digest checks
- approval records
- capability provenance and locking work
- run locking and stale-lock recovery
- state revisions and recovery work
- repository identity binding
- evidence, findings, reporting, comparison, audit, and promotion records
- repair transaction and rollback controls
- package and binary distribution checks
- Claude Code, Codex, and Gemini CLI adapters
- registry package construction, verification, pull, and content-addressed cache work
- CI, release workflows, contract validation, package smoke tests, frontend checks, and release-truth validation

However, the current code and documentation expose several production blockers.

### 2.1 Playbook composition is still step-centric, not data-flow-centric

`PlaybookStep` identifies one capability and its execution policy, but there is no first-class typed input/output contract between steps.

This makes a multi-Skill Playbook weaker than it should be. A long-running flow needs to define not only "run Skill B after Skill A", but also exactly what artifact or structured output Skill B is allowed to consume from Skill A.

Production requirement:

```text
Step A output contract
  -> persisted artifact or typed value
  -> digest and provenance
  -> Step B declared input binding
  -> validation before Step B starts
```

No implicit prompt-memory handoff should be considered sufficient for a production Playbook.

### 2.2 The runtime is primarily an ordered secure executor

The current engine iterates through declared stages and steps and routes execution through analysis, remediation, or verification paths. This is useful, but a general Playbook engine needs a capability invocation protocol independent of those three security-oriented modes.

The orchestration core must support arbitrary declared capability entry points while preserving Dokion's controls.

### 2.3 Long-running execution needs a stronger durable-run contract

The repository already has state, run locking, checkpoint work, resume, event logging, and repository identity checks. Production long-running work additionally requires an explicit run lifecycle with leases, heartbeats, resumable invocation boundaries, idempotency keys, and side-effect classification.

Dokion must be able to answer after a crash:

- Did the capability never start?
- Did it start but return no completion receipt?
- Did it complete and Dokion crash before persisting the result?
- Is it safe to retry?
- Does the step require user review before retrying?

### 2.4 Capability handoff across agent clients is not yet a universal execution contract

Claude Code, Codex, Gemini CLI, and ordinary shell environments do not expose identical enforcement features.

Production Dokion needs a host capability matrix that drives behavior, not only documentation. If a host cannot provide a guarantee, the run must either:

1. use a compensating Dokion-controlled execution path,
2. record a degradation and cap the claim, or
3. refuse the Playbook if the required guarantee is mandatory.

### 2.5 Completion checklists have drifted from runtime evidence

Historical production tasks are marked complete, but some implementations remain contract skeletons rather than independently gathered production evidence.

Example class: reliability, performance, and accessibility evaluators currently accept supplied metrics. Production assurance requires trusted collectors, tool provenance, bounded execution, captured raw evidence, and reproducible evaluation.

The new roadmap therefore treats previous checkboxes as historical implementation records, not proof of current production readiness.

### 2.6 Registry and Store truth boundaries are inconsistent

The core README correctly states that registry install, activation, publishing, and Store behavior are unavailable in the current release line.

The frontend currently contains browser-local checkout, licensing, token generation, installation, activation, and package URL behavior that can look like real marketplace functionality.

This is a P0 product-integrity problem.

A production build must either:

- make these flows real through the approved registry protocol and trusted server-side boundaries, or
- remove/quarantine them from the production surface and label them as non-production fixtures.

### 2.7 Frontend trust boundaries are not production-grade

The frontend currently has its own dependency stack, local IndexedDB state, payment-like logic, package installation-like logic, and AI-related environment configuration.

If the frontend remains part of Dokion, it needs its own threat model, identity/auth model, CSP, dependency policy, server trust boundary, end-to-end tests, accessibility tests, and deployment contract.

### 2.8 Release verification still needs supply-chain tightening

The release pipeline is already substantial, but the final production line should require:

- immutable SHA-pinned GitHub Actions
- exact pinned Python build/test dependencies with hash verification
- no unreviewed remote package execution in release verification
- SBOM for npm package and standalone binaries
- provenance attestation tied to the exact source commit
- artifact signing or an established signing/attestation mechanism
- reproducibility checks where feasible
- protected release environment and least-privilege permissions

### 2.9 Current HEAD has no retrieved workflow-run proof in this audit

Static workflow definitions were inspected, but production readiness must be based on a release-candidate evidence bundle generated by CI for the exact candidate commit. Documentation or historical commit messages are not sufficient.

## 3. Target architecture

Production Dokion should be organized around six first-class contracts.

### Contract A: Playbook Contract

The Playbook defines what must happen.

It owns:

- stages
- steps
- capability references
- input/output bindings
- dependencies
- execution policies
- permissions
- approvals
- retries and budgets
- verification
- completion criteria
- release gates

The runtime may not silently add, remove, replace, or reorder declared work.

### Contract B: Capability Invocation Contract

Every executable capability is invoked through one normalized interface.

Suggested conceptual request:

```json
{
  "run_id": "...",
  "stage_id": "...",
  "step_id": "...",
  "invocation_id": "...",
  "capability": {
    "type": "skill",
    "id": "security-review",
    "immutable_reference": "sha256:..."
  },
  "inputs": {},
  "permissions": {},
  "budget": {},
  "workspace": {},
  "expected_outputs": []
}
```

Suggested conceptual receipt:

```json
{
  "invocation_id": "...",
  "status": "SUCCEEDED",
  "outputs": [],
  "findings": [],
  "evidence": [],
  "side_effects": [],
  "verification": [],
  "started_at": "...",
  "ended_at": "..."
}
```

The protocol must be transport-neutral enough to support Skills, CLI tools, MCP operations, plugins, and agent/subagent adapters.

### Contract C: Artifact and Handoff Contract

Every material output that crosses a step boundary becomes a Dokion artifact.

An artifact should record:

- artifact ID
- producing invocation
- media type or schema ID
- path or value reference
- SHA-256 digest
- size
- creation time
- repository identity
- sensitivity classification
- retention policy

Steps consume only declared inputs.

This turns multi-Skill workflows into explicit, inspectable data flow instead of relying on agent memory.

### Contract D: Durable Run Contract

A run is a durable state machine, not a process lifetime.

Minimum lifecycle:

```text
CREATED
READY
RUNNING
WAITING_APPROVAL
WAITING_EXTERNAL
PAUSED
RECOVERING
COMPLETED
BLOCKED
FAILED
TAINTED
STALE
CANCELLED
```

Every external side effect gets a durable invocation record and idempotency policy.

### Contract E: Host Enforcement Contract

Each host declares what it can actually guarantee.

Examples:

- pre-tool interception
- filesystem restriction
- shell mediation
- process isolation
- environment isolation
- subagent isolation
- network mediation
- background-task observation
- cancellation
- deterministic resume

A Playbook can declare required host guarantees. Dokion refuses execution when mandatory guarantees cannot be provided.

### Contract F: Evidence and Completion Contract

"Completed" is derived, never asserted by the agent.

A run completes only when:

- every required step reached an allowed terminal state
- all declared handoff outputs validate
- required evidence exists and matches digests
- no unresolved blocking finding remains
- required approvals are present
- release gates pass
- repository and Playbook identity remain valid
- no mandatory host guarantee was lost

## 4. Production maturity model

Use explicit levels so the project never jumps from "tests pass" to "production grade".

### P0 - Truthful baseline

The repository, README, frontend, docs, CLI, and generated product surface agree on what is implemented.

### P1 - Deterministic single-host Playbook runtime

One supported host can execute a multi-capability Playbook with durable state, typed handoffs, recovery, and evidence.

### P2 - Multi-capability long-running reliability

Crash recovery, idempotency, resumable invocations, large outputs, time budgets, cancellation, and approval waits are proven.

### P3 - Cross-host contract enforcement

Claude Code, Codex, Gemini CLI, and shell surfaces pass the same host contract suite, with explicit degradation where guarantees differ.

### P4 - Registry and distribution integrity

Playbooks can be packaged, discovered, pulled, installed inertly, inspected, activated explicitly, updated, rolled back, and reproduced from lockfiles.

### P5 - Operational production readiness

Release provenance, security testing, observability, documentation, support procedures, compatibility policy, and release-candidate evidence all pass.

No public "production grade" wording should appear before P5 is proven for the exact release candidate.

## 5. Delivery program

## Phase 0 - Rebaseline and truth reset

Priority: P0

Goal: establish a machine-derived current baseline before adding new orchestration features.

Tasks:

1. Create `scripts/audit-current-capabilities.ts` that derives implemented command, schema, adapter, registry, and Playbook surfaces from source.
2. Generate `generated/current-capabilities.json`.
3. Compare `tasks.md`, `implementation_plan.md`, README, frontend claims, docs, issues, and generated surfaces against runtime evidence.
4. Mark historical plans explicitly as historical when they reference removed or moved paths.
5. Add CI tests that reject "implemented" status without a corresponding executable contract test.
6. Quarantine or remove production-looking frontend Store/payment/install behavior until it is backed by the registry protocol.
7. Add a release-candidate baseline report containing commit, lockfiles, tool versions, test inventory, adapter matrix, and known exclusions.

Exit gate:

- One machine-generated baseline is the source for public implementation claims.
- No UI or docs claim a flow that the CLI and protocol cannot prove.

## Phase 1 - Playbook Contract V2

Priority: P0

Goal: make the Playbook a real multi-capability workflow contract.

Add `dokion.playbook.v2` with backward-compatible migration from v1.

Required additions:

- step `inputs`
- step `outputs`
- `output_schema`
- `artifact_bindings`
- explicit `capability.entrypoint`
- capability invocation timeout and heartbeat policy
- step idempotency policy
- compensation/rollback policy for external effects
- sensitivity labels for artifacts and environment values
- host guarantee requirements
- deterministic parameter expansion
- explicit fan-in/fan-out semantics for future DAG support

Initial production scope should remain sequential by default. Parallel execution should stay experimental until artifact ownership, write isolation, cancellation, and merge semantics are proven.

Primary files:

- `schemas/dokion-playbook.schema.json`
- `src/playbook/types.ts`
- `src/playbook/load-playbook.ts`
- `src/engine/dependencies.ts`
- new `src/playbook/v2/**`
- new `tests/playbook-v2/**`

Exit gate:

- A three-Skill Playbook can pass typed, digest-bound artifacts from Skill A to Skill B to Skill C with no implicit context dependency.

## Phase 2 - Universal Capability Invocation Runtime

Priority: P0

Goal: separate orchestration from security-specific analyze/remediation branches.

Introduce:

- `CapabilityInvoker` interface
- normalized invocation request and receipt schemas
- adapters for Skill, command, tool, MCP, plugin, agent, and subagent
- capability-specific entrypoint resolution
- invocation-scoped permissions
- output validation
- side-effect declarations
- error taxonomy

Keep existing analysis/remediation behavior as adapters on top of the new invocation runtime, not as the orchestration core itself.

Primary files:

- new `schemas/dokion-invocation.schema.json`
- new `schemas/dokion-invocation-receipt.schema.json`
- new `src/invocation/**`
- refactor `src/engine/capability-runner.ts`
- refactor `src/engine/runtime-engine.ts`
- `src/capability/**`
- `tests/invocation/**`

Exit gate:

- The engine can run a Playbook composed of heterogeneous capability types through one normalized contract.

## Phase 3 - Artifact graph and deterministic handoff

Priority: P0

Goal: make long-running multi-Skill workflows reproducible and inspectable.

Build:

- artifact manifest schema
- content-addressed artifact storage
- typed JSON outputs
- file/directory artifact references
- output size limits
- artifact sensitivity and redaction
- step input resolver
- schema validation before consumption
- provenance links from artifact to invocation and source capability
- artifact garbage collection that respects retention classes

Suggested local layout:

```text
.dokion/
  runs/<run-id>/
    state.json
    events.ndjson
    invocations/
    artifacts/
    evidence/
```

Do not keep one mutable global `.dokion/state.json` as the only durable run record once multiple historical or concurrent read-only runs are supported.

Exit gate:

- Every cross-step handoff can be reconstructed without access to the original agent conversation.

## Phase 4 - Long-running run coordinator

Priority: P0

Goal: survive hours or days of work safely.

Implement:

- run coordinator
- invocation leases
- heartbeat records for capabilities that support them
- explicit `WAITING_EXTERNAL` and `PAUSED` states
- cancellation tokens
- deterministic timeout handling
- retry classification: safe, unsafe, user-decision-required
- idempotency keys
- orphan invocation detection
- recovery reconciliation
- bounded log/output streaming
- resumable approval waits
- resumable host restarts
- time and cost budgets
- maximum wall-clock run limits

The run coordinator must distinguish process death from run death.

Exit gate:

- Kill Dokion at every durable boundary in a seeded 20-step workflow. Restart it and prove that no completed side effect is duplicated and no unknown side effect is silently retried.

## Phase 5 - Enforcement and anti-deviation layer

Priority: P0

Goal: make "follow the Playbook" an executable guarantee within supported host boundaries.

Add an enforcement decision service used before every mediated action.

Inputs:

- current run state
- active Playbook digest
- current step
- host capabilities
- requested action
- requested scope
- capability identity

Outputs:

- ALLOW
- DENY
- REQUIRE_APPROVAL
- DEGRADE_AND_RECORD
- TAINT_RUN

Enforce:

- no undeclared capability
- no step skipping
- no silent reordering
- no undeclared writes
- no undeclared command/environment/network access
- no capability substitution
- no hidden retry beyond policy
- no completion without evidence
- no Playbook mutation
- no use of future-step artifacts

Add adversarial tests that attempt to make an agent:

- skip a verification step
- replace one Skill with another
- widen filesystem scope
- continue after failed blocking gate
- claim success after timeout
- alter the Playbook
- smuggle data through undeclared environment variables

Exit gate:

- Every tested deviation is blocked or explicitly degraded according to host capability.

## Phase 6 - Cross-host adapter contract suite

Priority: P0

Goal: make host differences executable and testable.

Create one contract matrix for:

- Claude Code
- Codex
- Gemini CLI
- shell/local CLI

For each host test:

- identity detection
- capability invocation
- tool/shell mediation
- approvals
- cancellation
- output collection
- resume
- Playbook mutation detection
- write-scope enforcement
- subagent behavior
- unsupported guarantee reporting

Add real host integration tests in isolated sample repositories where automation permits it.

The compatibility document should be generated from passing adapter contracts, not manually maintained prose.

Exit gate:

- A host cannot be listed as supported unless its exact adapter contract passes for the release candidate.

## Phase 7 - Registry, package, install, and activation completion

Priority: P0 for registry release, otherwise excluded from the production claim.

Continue the federated content-addressed design already documented in the repository.

Required production path:

```text
search
-> inspect
-> pull verified bytes
-> cache
-> install inert package
-> write deterministic lockfile
-> review authority diff
-> explicit activation
-> execute
```

Never merge install and activation.

Required hardening:

- immutable source revisions
- bounded network retrieval
- redirect policy
- archive bomb protection
- no symlinks/hardlinks in v1 packages
- canonical package serialization
- verified file manifest
- atomic cache publication
- lockfile CAS revisions
- source revocation/deprecation
- offline verification
- rollback of install/update transitions
- established signature/provenance mechanism

Exit gate:

- A clean machine can reproduce the exact installed inert Playbook package and verify every byte from the lockfile without trusting the Store UI.

## Phase 8 - Frontend and Store decision

Priority: P0 truth boundary

Choose one of two paths.

### Option A: Documentation and inspector only

Preferred until the registry protocol is complete.

The frontend is a read-only documentation, Playbook inspection, compatibility, and evidence viewer generated from validated repository/registry data.

Remove payment, licensing, fake install, fake activation, fake package URLs, synthetic metrics, and browser-local authority changes.

### Option B: Real marketplace

Only after the registry is production-ready.

Requires:

- server-side identity
- publisher authentication/authorization
- real payment provider boundary
- signed webhook verification
- entitlement service
- secure download authorization
- abuse controls
- rate limits
- audit logs
- privacy and retention policy
- marketplace moderation/revocation process

Client-generated license keys or Base64 "signed" tokens must never be used for production authorization.

Exit gate:

- Every Store action is either read-only and evidence-derived or backed by a real authenticated server contract.

## Phase 9 - Release and supply-chain hardening

Priority: P0

Required controls:

- pin GitHub Actions by immutable commit SHA
- pin Python tooling exactly and verify dependency hashes
- avoid network-fetched executables during final release verification unless pinned and independently verified
- generate npm and binary SBOMs
- generate SLSA-compatible provenance where practical
- sign or attest release artifacts using an established mechanism
- checksum all artifacts
- verify the release bundle on a separate job before publication
- require protected environment approval for publication
- publish only from exact version tags
- verify npm package contents against the tested tarball
- verify standalone binaries on their target OS/architecture matrix
- test clean install with no repository source tree present
- keep release credentials out of build jobs

Exit gate:

- The published npm tarball and every binary can be traced to the exact tested source commit and verified artifact manifest.

## Phase 10 - Quality engineering

Priority: P0/P1

Add production test classes beyond unit and contract tests:

- property tests for state transitions
- fuzzing for Playbook parsing, path rules, artifact extraction, lockfiles, registry packages, and command specs
- mutation testing for critical enforcement decisions
- fault injection at every durable write and invocation boundary
- race tests for state CAS and cache publication
- soak tests for long-running Playbooks
- large-output and disk-pressure tests
- slow/stalled child process tests
- network fault tests
- corrupted evidence/artifact tests
- clock-skew tests where timestamps affect policy
- Windows/macOS/Linux behavior tests
- frontend browser E2E and accessibility tests if frontend ships

Add explicit coverage thresholds only where they protect meaningful code. Do not use aggregate coverage percentage as a production-readiness substitute.

Exit gate:

- Critical state, enforcement, package, and artifact paths have negative, adversarial, and fault-injection coverage.

## Phase 11 - Observability and operator experience

Priority: P1

Dokion is local-first, but production users still need diagnosability.

Add:

- structured local logs with run/invocation IDs
- `dokion diagnose`
- deterministic support bundle with secret redaction
- run timeline
- current wait/block reason
- remaining budget
- capability invocation timings
- retry reasons
- host degradations
- disk/evidence usage
- registry cache health

Telemetry must remain optional and outside execution authority.

Exit gate:

- A failed run can be diagnosed from a sanitized support bundle without access to the user's agent chat transcript.

## Phase 12 - Documentation as an executable product surface

Priority: P0 for public production claim

Use a GitBook-compatible information architecture even when source remains in Git.

Recommended top-level documentation:

```text
Introduction
Getting Started
Playbooks
  Playbook vs Skill
  Playbook Contract
  Multi-Skill Composition
  Inputs and Outputs
  Approvals and Permissions
  Long-Running Runs
Execution Engine
  State Machine
  Capability Invocation
  Enforcement
  Recovery
Artifacts and Evidence
Registry and Packages
Agent Integrations
Security
CLI Reference
Operations
Troubleshooting
Release and Compatibility
Contributing
```

Rules:

- docs are edited through reviewable Git changes
- GitBook, if connected with Git Sync, is a publication surface rather than execution authority
- CLI reference is generated from the command registry
- schema examples validate in CI
- compatibility pages are generated from adapter test evidence
- diagrams are versioned with the architecture they describe
- implemented, experimental, planned, and unsupported states are visually distinct
- every production claim links to a test, contract, generated evidence file, or release artifact

Exit gate:

- A new user can install Dokion, understand Playbook vs Skill, run a supported multi-Skill Playbook, pause/resume it, inspect evidence, and understand any degraded guarantees using only the published docs.

## 6. Recommended repository restructuring

Do not perform a broad rename-only refactor. Introduce boundaries as the new contracts land.

Suggested target:

```text
src/
  playbook/
    v1/
    v2/
    compiler/
  orchestration/
    coordinator.ts
    scheduler.ts
    state-machine.ts
    enforcement.ts
  invocation/
    contract.ts
    registry.ts
    adapters/
  artifacts/
    manifest.ts
    store.ts
    bindings.ts
    retention.ts
  runs/
    store.ts
    lease.ts
    recovery.ts
    cancellation.ts
  capabilities/
  approvals/
  evidence/
  registry/
  platform/
  security/
```

The existing code should migrate incrementally into these boundaries under tests.

## 7. Production gates

A release may use the term "production-grade Playbook engine" only when all applicable gates pass on the exact release candidate.

### PG2-001 Playbook authority

No runtime path can execute undeclared work or mutate active authority.

### PG2-002 Multi-capability composition

A Playbook can coordinate at least three heterogeneous capabilities with typed artifact handoffs.

### PG2-003 Durable long-running execution

Crash/restart, pause, approval wait, timeout, cancellation, and safe retry behavior pass fault-injection tests.

### PG2-004 Anti-deviation enforcement

Undeclared capability, reorder, skip, scope widening, substitution, and false completion attempts are rejected or correctly degraded.

### PG2-005 Artifact provenance

Every cross-step artifact is digest-bound to its producer and validates before consumption.

### PG2-006 Host contract truth

Every supported host passes its adapter suite and all weaker guarantees are visible in machine output.

### PG2-007 Registry integrity

If registry/install is included in the release claim, pull/install/activate/update/rollback all pass from clean environments with immutable package evidence.

### PG2-008 Release provenance

Package and binary artifacts have checksums, SBOM, provenance, target-platform smoke evidence, and protected publication controls.

### PG2-009 Security

Threat model, adversarial tests, secret handling, path boundaries, process containment, package extraction, and vulnerability-response requirements pass.

### PG2-010 Product truth

README, docs, frontend, generated surfaces, CLI help, and release notes contain no unsupported feature or guarantee.

### PG2-011 Operational diagnosis

Failures produce deterministic, redacted diagnostics sufficient for support and recovery.

### PG2-012 Release-candidate sign-off

A generated sign-off bundle ties every gate to the exact source commit, dependency locks, binaries, package tarball, schemas, compatibility matrix, and test evidence.

## 8. First implementation sequence

Do not start by adding more Skills or more Playbook templates.

Recommended first six PRs:

### PR 1 - Current truth rebaseline

- machine-generated implementation inventory
- frontend truth quarantine
- historical-plan labeling
- new release-candidate evidence index

### PR 2 - Playbook V2 contracts

- typed inputs/outputs
- artifact bindings
- host requirements
- idempotency and compensation declarations
- v1 migration tests

### PR 3 - Capability invocation protocol

- invocation request/receipt schemas
- capability adapter registry
- migrate command and Skill execution first

### PR 4 - Artifact store and handoff

- artifact manifests
- content addressing
- output validation
- step input resolution

### PR 5 - Durable run coordinator

- run-scoped storage
- leases
- heartbeat/cancellation
- reconciliation after crash
- safe retry classifier

### PR 6 - Enforcement decision service

- one policy boundary before every mediated action
- adversarial deviation suite
- host guarantee requirements

Only after these six PRs should the team expand registry UX, Store UX, or additional Playbook catalogs.

## 9. Engineering rules for this program

Every behavior change should follow test-first development where practical.

Each PR must include:

- problem statement
- affected invariant
- negative control
- migration impact
- rollback path
- focused tests
- full required verification
- documentation impact
- claim impact

For critical runtime changes, include a fault-injection or adversarial test in addition to the happy path.

No task is complete because a file exists or a checkbox was updated.

A task is complete when the runtime behavior, contract, tests, evidence, docs, and release claim all agree.

## 10. Definition of done

Dokion reaches the intended production-grade state when a user can take an approved long-running Playbook composed of multiple Skills and other capabilities and rely on Dokion to:

1. validate exactly what the Playbook declares
2. prove the identity of every capability it can prove
3. execute only the declared order and dependencies
4. pass structured outputs between steps without implicit chat-memory dependence
5. enforce permissions and approvals
6. survive interruption without repeating unsafe side effects
7. resume from durable state
8. block or record agent deviation
9. preserve artifacts, findings, and evidence
10. verify the declared completion conditions independently
11. expose weaker guarantees when a host cannot enforce a requirement
12. reproduce the run from the Playbook, lock data, artifacts, and evidence within documented limits
13. publish only claims that are backed by release-candidate evidence

At that point Dokion is no longer best described as a hardened Skill wrapper.

It is a durable Playbook execution-control runtime for agentic work.
