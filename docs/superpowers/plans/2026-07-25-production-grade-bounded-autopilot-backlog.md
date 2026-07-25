# Dokion Production-Grade Bounded Autopilot Backlog

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Implement one numbered commit at a time.

**Goal:** Move Dokion from the current M0-M6 baseline to a production-grade, user-directed, bounded-autopilot hardening system through exactly 100 coherent implementation commits.

**Baseline:** `main` at `c254af2f5a4d07c9f1f3b84d6c0226760702bbbb`, audited 2026-07-25. Package version: `0.3.0`. Runtime: Bun 1.3.14 or newer.

## Current baseline and confirmed gaps

Already present: immutable playbook loading, ordered execution, disk state and events, evidence, resume, findings, approvals, adversarial repair validation, exact rollback, coverage and release gates, cross-agent adapters, package validation, clean-install tests, five compiled binaries, and tag publishing.

Confirmed gaps:

- `README.md` says M0-M6 are implemented while `SPEC.md` still says spec-stage.
- The manifest and spec list commands missing from `src/cli.ts`: `configure`, `plan`, `step`, `skip`, and `reset --state-only`.
- `verify` validates contracts instead of re-running configured gates.
- `doctor` does not resolve declared capabilities, versions, digests, conflicts, or provenance.
- The capability lock is not yet a complete runtime subsystem.
- Command execution uses a POSIX shell, inherits the full environment, buffers output, and does not terminate process trees.
- Ignored untracked files are outside repair snapshots.
- There is no exclusive run lock, event hash chain, compare-and-swap state, state migration system, or independent audit command.
- There is no typed module lifecycle for assurance packs.
- CI is mostly Ubuntu based, lacks coverage, property, mutation, and performance gates, and hardcodes release-version assertions.
- Releases do not yet include an SBOM or build provenance attestation.

## Bounded autopilot contract

1. `.dokion/playbook.json` remains the sole execution authority.
2. Autopilot may execute only declared steps in declared order with declared permissions.
3. It stops at required approvals, changed playbook or lock, changed repository identity, missing evidence, exhausted budgets, unsupported guarantees, or a blocking policy.
4. It never selects, installs, substitutes, reorders, upgrades, or enables a capability.
5. It never expands write scope, changes release gates, silences findings, activates a proposed playbook, or deploys to production.
6. Recommendations and generated proposals remain inert.
7. Secrets never enter repository files, state, events, evidence, reports, output, or release artifacts.
8. Completion claims are qualified by exact playbook digest, target commit, evidence, gates, coverage, and degradations.

## Commit rules and verification

The commit adding this file is planning commit 0 and is not included in the 100 implementation commits. Do not create formatting-only, empty, or artificial commits.

Every numbered commit follows the same cycle: add a targeted failing test, prove the intended failure, implement the smallest coherent behavior, pass targeted and related tests, run typecheck, review authority and secret boundaries, then commit.

At every phase gate run:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

For distribution, adapter, or release changes also run:

```bash
bun run validate:distribution
bun run smoke:package
bun run scripts/build-release.ts
bunx @google/gemini-cli@0.51.0 extensions validate .
```

## Planned boundaries

`src/cli/` handles parsing and handlers. `src/autopilot/` handles deterministic continuation. `src/policy/` owns approval, failure, permission, environment, and worktree rules. `src/capabilities/` owns resolution and provenance. `src/modules/` owns module contracts. `src/execution/` owns processes. `src/state/` owns crash-safe state and journal integrity. `src/validation/` owns repair transactions. `src/readiness/` owns completion and claims. `src/report/`, `src/export/`, and `src/audit/` make results independently checkable. `modules/` contains inert assurance packs that run only when declared.

---

## Phase 1 - Establish one source of truth

- [ ] **001. `docs: record audited production baseline`**  
  Files: `docs/architecture/current-baseline.md`, `tests/contracts/baseline-inventory.test.ts`  
  Acceptance: The document and test agree on version 0.3.0, M0-M6 scope, supported agents, shipped commands, schemas, workflows, and known limitations at audited main `c254af2`.

- [ ] **002. `docs: reconcile specification implementation status`**  
  Files: `SPEC.md`, `README.md`, `tests/contracts/document-status.test.ts`  
  Acceptance: `SPEC.md` no longer claims the repository is unimplemented; status and milestone wording match runtime reality without overstating readiness.

- [ ] **003. `docs: define bounded autopilot semantics`**  
  Files: `docs/architecture/bounded-autopilot.md`, `SPEC.md`  
  Acceptance: The contract states exactly what Dokion may continue automatically, every mandatory pause, and every forbidden action. The active playbook remains the only execution authority.

- [ ] **004. `docs: publish production readiness definition`**  
  Files: `docs/architecture/production-readiness.md`, `SPEC.md`  
  Acceptance: Production-grade means the runtime itself passes the listed security, recovery, portability, evidence, release, and seeded-fixture gates. It never means an audited target repository is generally safe.

- [ ] **005. `test: enforce manifest runtime command parity`**  
  Files: `tests/contracts/cli-parity.test.ts`, `src/cli/command-registry.ts`  
  Acceptance: The test fails when `dokion.json`, `SPEC.md`, help output, adapters, or runtime handlers disagree about a command or option.

- [ ] **006. `refactor: centralize command metadata`**  
  Files: `src/cli/command-registry.ts`, `src/cli.ts`, `src/catalog/builtin-catalog.ts`  
  Acceptance: Help, command lookup, mode, write scope, approval class, and adapter generation read from one typed registry.

- [ ] **007. `docs: add architecture decision record index`**  
  Files: `docs/adr/README.md`, `docs/adr/0001-authority-model.md`, `docs/adr/0002-bun-only-runtime.md`  
  Acceptance: Existing authority and Bun-only decisions are recorded with context, decision, consequences, and amendment rules.

- [ ] **008. `security: add repository threat model`**  
  Files: `docs/security/threat-model.md`, `SECURITY.md`  
  Acceptance: Threats cover malicious playbooks, poisoned skill text, shell injection, path traversal, symlinks, state tampering, secret leakage, compromised releases, and cross-agent degradation.

- [ ] **009. `docs: define atomic commit and review policy`**  
  Files: `CONTRIBUTING.md`, `docs/engineering/commit-policy.md`  
  Acceptance: Each implementation commit has one reviewable behavior, a targeted test, no unrelated formatting, and a rollback boundary. Artificial commit splitting is explicitly rejected.

- [ ] **010. `docs: add support and compatibility matrix`**  
  Files: `docs/compatibility.md`, `README.md`  
  Acceptance: The matrix separates package mode, standalone binary mode, Claude Code, Codex, Gemini CLI, Linux, macOS, and Windows claims, with tested and degraded states.

## Phase 2 - Complete and harden the CLI surface

- [ ] **011. `refactor: extract typed CLI argument parser`**  
  Files: `src/cli/parser.ts`, `src/cli/types.ts`, `src/cli.ts`, `tests/cli/parser.test.ts`  
  Acceptance: Unknown options, missing values, duplicate singular options, and malformed subjects return stable Dokion error codes instead of generic stack traces.

- [ ] **012. `feat: add consistent output format selection`**  
  Files: `src/cli/output.ts`, `src/cli/parser.ts`, `tests/cli/output.test.ts`  
  Acceptance: Every command supports deterministic human output and `--format json`; stdout contains results and stderr contains diagnostics only.

- [ ] **013. `feat: implement read-only execution plan rendering`**  
  Files: `src/plan/render-plan.ts`, `src/cli/handlers/plan.ts`, `tests/cli/plan.test.ts`  
  Acceptance: `dokion plan` renders the exact active playbook order, permissions, approvals, gates, and skipped applicability predictions without executing commands or editing the active playbook.

- [ ] **014. `feat: implement inert proposal authoring`**  
  Files: `src/plan/proposal.ts`, `src/cli/handlers/plan.ts`, `tests/cli/proposal.test.ts`  
  Acceptance: `dokion plan --from <user-selection.json> --write-proposal` writes only `.dokion/playbook.proposed.json`, never infers undeclared capabilities, and never activates the proposal.

- [ ] **015. `feat: implement guarded configure command`**  
  Files: `src/cli/handlers/configure.ts`, `src/plan/configure-proposal.ts`, `tests/cli/configure.test.ts`  
  Acceptance: `dokion configure` edits only the proposed playbook, requires an interactive confirmation or explicit approved input file, and refuses to touch `.dokion/playbook.json`.

- [ ] **016. `feat: implement single-step execution`**  
  Files: `src/engine/step-executor.ts`, `src/cli/handlers/step.ts`, `tests/cli/step.test.ts`  
  Acceptance: `dokion step <step-id>` runs one declared and dependency-satisfied step, records evidence, and cannot bypass approval or applicability rules.

- [ ] **017. `feat: implement auditable skip decisions`**  
  Files: `src/approvals/skip-store.ts`, `src/cli/handlers/skip.ts`, `tests/cli/skip.test.ts`  
  Acceptance: `dokion skip <step-id> --by <identity> --reason <text>` works only for optional steps and records an append-only decision used by resume and reporting.

- [ ] **018. `feat: implement state-only reset`**  
  Files: `src/state/reset-state.ts`, `src/cli/handlers/reset.ts`, `tests/cli/reset.test.ts`  
  Acceptance: `dokion reset --state-only` archives the old run state, preserves playbook, findings, evidence, and reports, then initializes a new stopped state after approval.

- [ ] **019. `feat: add finding query filters`**  
  Files: `src/findings/query-findings.ts`, `src/cli/handlers/findings.ts`, `tests/cli/findings.test.ts`  
  Acceptance: Severity, status, stage, step, capability, and run filters compose deterministically and never mutate the ledger.

- [ ] **020. `feat: make verify execute configured gates`**  
  Files: `src/verification/verify-run.ts`, `src/cli/handlers/verify.ts`, `tests/cli/verify.test.ts`  
  Acceptance: `dokion verify` re-runs declared verification and release gates against the current commit, stores fresh evidence, and does not apply repairs.

## Phase 3 - Make state, journal, and resume crash-safe

- [ ] **021. `feat: add exclusive run locking`**  
  Files: `src/state/run-lock.ts`, `tests/state/run-lock.test.ts`  
  Acceptance: A second process cannot run, resume, step, reset, or verify the same project while a live lock exists; stale locks require a recorded recovery path.

- [ ] **022. `feat: add monotonic state revisions`**  
  Files: `src/state/types.ts`, `schemas/dokion-state.schema.json`, `src/state/state-store.ts`, `tests/state/revision.test.ts`  
  Acceptance: Every accepted state transition increments `revision`; compare-and-swap rejects stale writers.

- [ ] **023. `feat: validate event records with a schema`**  
  Files: `schemas/dokion-event.schema.json`, `src/state/event-log.ts`, `tests/state/event-schema.test.ts`  
  Acceptance: Every event has schema version, sequence, run id, timestamp, actor, event type, and typed payload.

- [ ] **024. `feat: hash-chain the append-only event log`**  
  Files: `src/state/event-chain.ts`, `src/state/event-log.ts`, `tests/state/event-chain.test.ts`  
  Acceptance: Each event contains previous and current digest; deletion, insertion, or modification is detected by `dokion audit`.

- [ ] **025. `feat: recover interrupted atomic writes`**  
  Files: `src/core/atomic-file.ts`, `src/state/state-store.ts`, `tests/state/atomic-recovery.test.ts`  
  Acceptance: Startup resolves or quarantines temporary files deterministically and never silently accepts partial JSON.

- [ ] **026. `feat: bind resume to repository identity`**  
  Files: `src/git/repository-identity.ts`, `src/engine/runtime-engine.ts`, `tests/state/resume-identity.test.ts`  
  Acceptance: Resume verifies repository root, remote identity when available, commit, branch, and playbook digest before continuing.

- [ ] **027. `feat: enforce declared dirty-worktree policy`**  
  Files: `src/git/worktree-policy.ts`, `src/playbook/types.ts`, `schemas/dokion-playbook.schema.json`, `tests/state/worktree-policy.test.ts`  
  Acceptance: A playbook explicitly chooses clean-only, allow-existing-dirty, or snapshot-existing-dirty; the default is clean-only for writes.

- [ ] **028. `feat: handle termination signals safely`**  
  Files: `src/runtime/signal-handler.ts`, `src/engine/runtime-engine.ts`, `tests/state/signal-recovery.test.ts`  
  Acceptance: SIGINT and SIGTERM stop child work, persist a checkpoint, append an interruption event, and leave the run resumable.

- [ ] **029. `feat: checkpoint every external side effect`**  
  Files: `src/state/checkpoint.ts`, `src/engine/runtime-engine.ts`, `src/engine/capability-runner.ts`, `tests/state/checkpoint.test.ts`  
  Acceptance: Intent is persisted before command, repair, rollback, approval wait, or report write; completion is persisted after it.

- [ ] **030. `feat: add versioned state migrations`**  
  Files: `src/state/migrations/index.ts`, `src/state/load-state.ts`, `tests/state/migrations.test.ts`  
  Acceptance: Supported older state schemas migrate through explicit pure functions; unknown future versions fail closed without rewriting data.

## Phase 4 - Resolve capabilities and provenance honestly

- [ ] **031. `feat: implement capability lock runtime`**  
  Files: `src/capabilities/lock-store.ts`, `src/capabilities/types.ts`, `tests/capabilities/lock-store.test.ts`  
  Acceptance: Resolved version, source, executable path, digest, installer exception, verification time, and provenance are stored in `.dokion/capabilities.lock.json`.

- [ ] **032. `feat: resolve declared executables deterministically`**  
  Files: `src/capabilities/executable-resolver.ts`, `tests/capabilities/executable-resolver.test.ts`  
  Acceptance: Resolution uses the declared command and allowed PATH, rejects ambiguous matches when policy requires one path, and records the canonical executable.

- [ ] **033. `feat: verify capability versions`**  
  Files: `src/capabilities/version-verifier.ts`, `tests/capabilities/version-verifier.test.ts`  
  Acceptance: Exact, range, and command-output version rules are evaluated without interpreting untrusted output as instructions.

- [ ] **034. `feat: verify immutable file digests`**  
  Files: `src/capabilities/digest-verifier.ts`, `tests/capabilities/digest-verifier.test.ts`  
  Acceptance: Files, skill directories, plugin manifests, and adapter entrypoints are hashed canonically and compared with approved digests.

- [ ] **035. `feat: verify pinned git sources`**  
  Files: `src/capabilities/git-source-verifier.ts`, `tests/capabilities/git-source-verifier.test.ts`  
  Acceptance: Declared repository URL and commit SHA must match the installed capability source; mutable branch-only declarations are rejected for execution.

- [ ] **036. `feat: record package provenance`**  
  Files: `src/capabilities/package-provenance.ts`, `tests/capabilities/package-provenance.test.ts`  
  Acceptance: Package manager, registry, package name, version, integrity, and installer command are recorded without storing credentials.

- [ ] **037. `feat: enforce installer exception policy`**  
  Files: `src/capabilities/installer-exception.ts`, `tests/capabilities/installer-exception.test.ts`  
  Acceptance: A non-Bun installer is accepted only when declared, documented, approved, and recorded with reason and verifier.

- [ ] **038. `feat: validate environment prerequisites safely`**  
  Files: `src/capabilities/environment-check.ts`, `tests/capabilities/environment-check.test.ts`  
  Acceptance: Presence and allowed shape of required variables may be checked, but values are never printed, persisted, hashed into reports, or passed to undeclared steps.

- [ ] **039. `feat: detect capability conflicts`**  
  Files: `src/capabilities/conflict-detector.ts`, `tests/capabilities/conflict-detector.test.ts`  
  Acceptance: Conflicting write scopes, incompatible versions, duplicate responsibilities, and unsafe parallel declarations become blocking validation results.

- [ ] **040. `feat: expand doctor into a declared capability audit`**  
  Files: `src/doctor/run-doctor.ts`, `src/cli/handlers/doctor.ts`, `tests/doctor/doctor.test.ts`  
  Acceptance: Doctor reports runtime, git, platform adapter, playbook, state, lock, capability availability, versions, digests, credentials-presence checks, and degradations.

## Phase 5 - Add bounded autopilot without weakening authority

- [ ] **041. `feat: add bounded autopilot command`**  
  Files: `src/cli/handlers/autopilot.ts`, `src/autopilot/run-autopilot.ts`, `tests/autopilot/command.test.ts`  
  Acceptance: `dokion autopilot` starts or resumes only the active approved playbook and refuses to run when validation, lock, or repository identity checks fail.

- [ ] **042. `feat: build deterministic next-action selection`**  
  Files: `src/autopilot/next-action.ts`, `tests/autopilot/next-action.test.ts`  
  Acceptance: The next action is derived only from declared order, dependencies, state, applicability, approvals, retry limits, and stop policies.

- [ ] **043. `feat: centralize approval boundary evaluation`**  
  Files: `src/policy/approval-policy.ts`, `src/autopilot/next-action.ts`, `tests/autopilot/approval-boundary.test.ts`  
  Acceptance: Every approval enum has one tested meaning across run, resume, step, repair, commit, and proposal workflows.

- [ ] **044. `feat: add bounded retry scheduling`**  
  Files: `src/autopilot/retry-policy.ts`, `tests/autopilot/retry-policy.test.ts`  
  Acceptance: Retries obey declared count, delay, maximum iterations, and retryable error classes; retries are journaled and never infinite.

- [ ] **045. `feat: add run budgets`**  
  Files: `src/autopilot/run-budget.ts`, `schemas/dokion-playbook.schema.json`, `tests/autopilot/run-budget.test.ts`  
  Acceptance: Playbooks may cap wall time, commands, repairs, findings, evidence bytes, and changed lines; reaching a cap stops with a precise reason.

- [ ] **046. `feat: complete failure policy handling`**  
  Files: `src/policy/failure-policy.ts`, `src/engine/runtime-engine.ts`, `tests/autopilot/failure-policy.test.ts`  
  Acceptance: STOP_PIPELINE, STOP_STAGE, CONTINUE, REQUEST_USER_DECISION, and MARK_BLOCKED have distinct state transitions and events.

- [ ] **047. `feat: classify stale runs before resume`**  
  Files: `src/autopilot/stale-run.ts`, `tests/autopilot/stale-run.test.ts`  
  Acceptance: Changed commit, changed lock, missing evidence, expired approval, or changed platform guarantees produce a review decision instead of blind continuation.

- [ ] **048. `feat: write inert recommendations`**  
  Files: `src/recommendations/recommendation-store.ts`, `src/report/render-hardening.ts`, `tests/autopilot/recommendations.test.ts`  
  Acceptance: Dokion can explain missing lanes, order risks, or unavailable capabilities, but recommendations never modify the active playbook or capability lock.

- [ ] **049. `feat: add dry-run decision traces`**  
  Files: `src/autopilot/trace.ts`, `src/cli/handlers/autopilot.ts`, `tests/autopilot/dry-run.test.ts`  
  Acceptance: `dokion autopilot --dry-run` emits each predicted transition and reason without executing commands or writing project source.

- [ ] **050. `test: prove bounded autopilot end to end`**  
  Files: `tests/autopilot/bounded-autopilot.e2e.test.ts`, `tests/fixtures/autopilot-project/**`  
  Acceptance: The fixture runs automatic approved steps, pauses at a required approval, resumes after a recorded decision, rejects an undeclared action, and completes with reconciled evidence.

## Phase 6 - Harden command execution and repair transactions

- [ ] **051. `refactor: add platform command strategies`**  
  Files: `src/execution/command-strategy.ts`, `src/execution/platform-shell.ts`, `tests/execution/platform-shell.test.ts`  
  Acceptance: Linux and macOS may use a declared POSIX shell; Windows uses an explicit compatible strategy; unsupported shell needs fail before execution.

- [ ] **052. `feat: support argument-vector commands`**  
  Files: `src/playbook/types.ts`, `schemas/dokion-playbook.schema.json`, `src/execution/command-spec.ts`, `tests/execution/command-spec.test.ts`  
  Acceptance: A step may declare executable plus argument array, avoiding shell parsing; legacy shell strings remain explicit and visibly higher risk.

- [ ] **053. `security: restrict command environments`**  
  Files: `src/execution/environment-policy.ts`, `src/engine/command-runner.ts`, `tests/execution/environment-policy.test.ts`  
  Acceptance: Only approved variables are inherited or added, dangerous loader variables are denied by default, and values are redacted from all artifacts.

- [ ] **054. `feat: spool bounded command output`**  
  Files: `src/execution/output-spool.ts`, `src/engine/command-runner.ts`, `tests/execution/output-spool.test.ts`  
  Acceptance: Large stdout and stderr stream to evidence files with byte limits, truncation markers, digests, and a small in-memory summary.

- [ ] **055. `feat: terminate complete process trees`**  
  Files: `src/execution/process-controller.ts`, `src/engine/command-runner.ts`, `tests/execution/process-controller.test.ts`  
  Acceptance: Timeout, signal, and cancellation terminate descendants, wait for exit, and record the termination reason on supported platforms.

- [ ] **056. `security: canonicalize all write scopes`**  
  Files: `src/security/path-policy.ts`, `src/validation/repair-validator.ts`, `tests/security/path-policy.test.ts`  
  Acceptance: Absolute paths, parent traversal, case-folding collisions, alternate separators, symlink escapes, and repository-root replacement are rejected.

- [ ] **057. `feat: cover bounded ignored files in snapshots`**  
  Files: `src/validation/ignored-file-policy.ts`, `src/validation/repair-snapshot.ts`, `tests/validation/ignored-files.test.ts`  
  Acceptance: Playbooks can name bounded ignored paths to include; size and file-count caps prevent scanning caches or dependency trees accidentally.

- [ ] **058. `feat: handle binary and large repair files`**  
  Files: `src/validation/file-snapshot.ts`, `tests/validation/binary-snapshot.test.ts`  
  Acceptance: Binary and oversized files use metadata and digests, never lossy text conversion; unsupported rollback cases block the repair before mutation.

- [ ] **059. `feat: persist repair transaction manifests`**  
  Files: `src/validation/repair-transaction.ts`, `src/engine/capability-runner.ts`, `tests/validation/repair-transaction.test.ts`  
  Acceptance: Before, after, validation, verification, rollback, digests, changed paths, and final disposition are linked in one transaction record.

- [ ] **060. `test: fuzz repair validation boundaries`**  
  Files: `tests/validation/repair-validator.fuzz.test.ts`, `tests/fixtures/repair-adversary/**`  
  Acceptance: Seeded and generated cases cover glob bypasses, Unicode paths, symlinks, test renames, suppression variants, large diffs, and rollback exactness.

## Phase 7 - Introduce a real module system and assurance packs

- [ ] **061. `feat: define module manifest schema`**  
  Files: `schemas/dokion-module.schema.json`, `src/modules/types.ts`, `tests/modules/module-schema.test.ts`  
  Acceptance: A module declares identity, version, responsibility, inputs, outputs, permissions, commands, supported platforms, findings mapping, and verification contract.

- [ ] **062. `feat: load modules from approved sources`**  
  Files: `src/modules/module-loader.ts`, `tests/modules/module-loader.test.ts`  
  Acceptance: Only modules referenced by approved capability declarations load; unknown local discovery does not enable or suggest execution.

- [ ] **063. `feat: define module lifecycle interfaces`**  
  Files: `src/modules/module.ts`, `src/modules/context.ts`, `tests/modules/lifecycle.test.ts`  
  Acceptance: Prepare, analyze, remediate, verify, and summarize phases have typed inputs and outputs with no implicit global state.

- [ ] **064. `feat: map module permissions to execution policy`**  
  Files: `src/modules/permission-mapper.ts`, `src/policy/permission-policy.ts`, `tests/modules/permissions.test.ts`  
  Acceptance: Module requests are intersected with playbook permissions; any expansion blocks before command execution.

- [ ] **065. `feat: add generic local command module adapter`**  
  Files: `src/modules/adapters/local-command.ts`, `tests/modules/local-command.test.ts`  
  Acceptance: Pinned local binaries can emit normalized findings and evidence through a documented JSON or SARIF contract.

- [ ] **066. `feat: add application security assurance pack`**  
  Files: `modules/application-security/module.json`, `modules/application-security/adapter.ts`, `tests/modules/application-security.test.ts`  
  Acceptance: The pack maps approved Semgrep-style output to normalized findings, records rule provenance, and never executes unless declared.

- [ ] **067. `feat: add supply chain assurance pack`**  
  Files: `modules/supply-chain/module.json`, `modules/supply-chain/adapter.ts`, `tests/modules/supply-chain.test.ts`  
  Acceptance: The pack supports approved OSV, secret-scan, dependency, SBOM, and container evidence while keeping each tool separately declared.

- [ ] **068. `feat: add API contract assurance pack`**  
  Files: `modules/api-contracts/module.json`, `modules/api-contracts/adapter.ts`, `tests/modules/api-contracts.test.ts`  
  Acceptance: The pack validates approved OpenAPI or schema contracts, authorization review evidence, and breaking-change results without claiming logic coverage it did not run.

- [ ] **069. `feat: add database hardening assurance pack`**  
  Files: `modules/database-hardening/module.json`, `modules/database-hardening/adapter.ts`, `tests/modules/database-hardening.test.ts`  
  Acceptance: The pack records migration safety, destructive statements, tenancy controls, backup evidence, and manual-review gaps with engine-agnostic inputs.

- [ ] **070. `feat: add observability and reliability pack`**  
  Files: `modules/observability-reliability/module.json`, `modules/observability-reliability/adapter.ts`, `tests/modules/observability-reliability.test.ts`  
  Acceptance: The pack covers structured logging, redaction, health checks, timeouts, retry policy, idempotency, metrics, traces, and declared manual evidence.

- [ ] **071. `feat: add performance and accessibility pack`**  
  Files: `modules/performance-accessibility/module.json`, `modules/performance-accessibility/adapter.ts`, `tests/modules/performance-accessibility.test.ts`  
  Acceptance: The pack accepts approved benchmark and accessibility artifacts, records thresholds, and keeps automated and manual coverage separate.

- [ ] **072. `feat: model unsupported AI and mobile lanes explicitly`**  
  Files: `modules/coverage-declarations/module.json`, `src/readiness/coverage.ts`, `tests/modules/coverage-declarations.test.ts`  
  Acceptance: AI safety and mobile-native security cannot appear covered without an assigned declared module; acknowledged gaps retain named rationale and readiness caps.

## Phase 8 - Make reports and evidence independently auditable

- [ ] **073. `feat: evaluate every completion criterion`**  
  Files: `src/readiness/completion.ts`, `src/state/types.ts`, `schemas/dokion-state.schema.json`, `tests/readiness/completion.test.ts`  
  Acceptance: Each criterion from SPEC section 11.3 is stored with pass, fail, blocked, or not-applicable status and evidence references.

- [ ] **074. `feat: qualify readiness claims centrally`**  
  Files: `src/readiness/readiness-statement.ts`, `tests/readiness/statement.test.ts`  
  Acceptance: All human and machine reports use one formatter tied to playbook digest, target commit, gates, coverage gaps, degradations, and timestamp.

- [ ] **075. `feat: report declared execution order and used capabilities`**  
  Files: `src/report/sections/execution.ts`, `tests/report/execution-section.test.ts`  
  Acceptance: The report lists every declared stage and step in order plus exact module, tool, skill, plugin, adapter, version, digest, and actual disposition.

- [ ] **076. `feat: report skipped work and unapplied recommendations`**  
  Files: `src/report/sections/exceptions.ts`, `tests/report/exceptions-section.test.ts`  
  Acceptance: Skipped steps, manual reviews, accepted risks, deferred findings, blocked lanes, and inert recommendations include actor, reason, and evidence.

- [ ] **077. `feat: add versioned JSON report export`**  
  Files: `src/report/json-report.ts`, `schemas/dokion-report.schema.json`, `tests/report/json-report.test.ts`  
  Acceptance: `dokion report --format json` emits a schema-valid deterministic document with relative artifact references.

- [ ] **078. `feat: add SARIF export`**  
  Files: `src/export/sarif.ts`, `tests/export/sarif.test.ts`  
  Acceptance: Normalized findings export to SARIF 2.1.0 with stable rule ids, locations, severity mapping, fingerprints, and evidence links.

- [ ] **079. `feat: add JUnit verification export`**  
  Files: `src/export/junit.ts`, `tests/export/junit.test.ts`  
  Acceptance: Stages, steps, and release gates export as deterministic test suites suitable for CI without changing Dokion state.

- [ ] **080. `feat: build evidence manifests and checksums`**  
  Files: `src/evidence/manifest.ts`, `schemas/dokion-evidence-manifest.schema.json`, `tests/evidence/manifest.test.ts`  
  Acceptance: Every run produces a sorted manifest of artifacts, sizes, media types, digests, producers, and redaction status.

- [ ] **081. `feat: compare two Dokion runs`**  
  Files: `src/report/compare-runs.ts`, `src/cli/handlers/compare.ts`, `tests/report/compare-runs.test.ts`  
  Acceptance: `dokion compare <run-a> <run-b>` explains new, resolved, regressed, changed, and incomparable results without merging state.

- [ ] **082. `feat: add independent audit command`**  
  Files: `src/audit/audit-run.ts`, `src/cli/handlers/audit.ts`, `tests/audit/audit-run.test.ts`  
  Acceptance: `dokion audit` verifies schemas, event hash chain, state revision, playbook and lock digests, evidence checksums, report reconciliation, and repository identity.

## Phase 9 - Prove cross-agent and platform behavior

- [ ] **083. `test: define canonical adapter contract suite`**  
  Files: `tests/adapters/adapter-contract.test.ts`, `src/platform/adapter-contract.ts`  
  Acceptance: Claude Code, Codex, Gemini CLI, and ordinary shell adapters expose the same canonical skill identity, command registry version, and authority warnings.

- [ ] **084. `feat: complete Claude Code plugin validation`**  
  Files: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `hooks/hooks.json`, `tests/adapters/claude.test.ts`  
  Acceptance: Strict plugin validation passes; the guard covers every Dokion write-capable operation and degrades honestly outside an active run.

- [ ] **085. `feat: package Codex skill and metadata consistently`**  
  Files: `.agents/skills/dokion-hardening/**`, `.codex/AGENTS.md`, `tests/adapters/codex.test.ts`  
  Acceptance: A clean Codex project can discover the canonical skill, read repository rules, invoke the installed CLI, and cannot receive adapter-only authority.

- [ ] **086. `feat: expose complete Gemini command coverage`**  
  Files: `commands/dokion/*.toml`, `gemini-extension.json`, `tests/adapters/gemini.test.ts`  
  Acceptance: Gemini commands cover help, doctor, plan, validate, run, autopilot, resume, status, findings, verify, report, and audit with no stale command text.

- [ ] **087. `feat: negotiate platform guarantees explicitly`**  
  Files: `src/platform/guarantees.ts`, `src/platform/platform-detector.ts`, `tests/platform/guarantees.test.ts`  
  Acceptance: Guarantees come only from explicit evidence or verified adapter probes; conflicting signals resolve to a weaker platform classification.

- [ ] **088. `feat: support Windows execution and path rules`**  
  Files: `src/execution/windows.ts`, `src/security/path-policy.ts`, `tests/platform/windows.test.ts`  
  Acceptance: Windows separators, drive roots, executable suffixes, process termination, temporary files, and case-insensitive path checks have dedicated tests.

- [ ] **089. `test: smoke-test native binaries on target operating systems`**  
  Files: `.github/workflows/platform-smoke.yml`, `tests/platform/binary-smoke.test.ts`  
  Acceptance: Linux x64, macOS arm64/x64 where hosted, and Windows x64 run help, built-in catalog validation, init, plan, and audit from clean directories.

- [ ] **090. `test: prove cross-agent handoff and resume`**  
  Files: `tests/adapters/cross-agent-handoff.e2e.test.ts`, `tests/fixtures/cross-agent/**`  
  Acceptance: A run started under one adapter resumes under another only after degradation and guarantee changes are recorded and approved when required.

## Phase 10 - Raise CI, release, and acceptance gates

- [ ] **091. `ci: split verification into focused required jobs`**  
  Files: `.github/workflows/ci.yml`, `scripts/verify.ts`  
  Acceptance: Contracts, unit tests, integration tests, typecheck, build, distribution, adapter validation, and mutation checks have separate results while one local command reproduces the gate.

- [ ] **092. `ci: add Linux macOS Windows test matrix`**  
  Files: `.github/workflows/ci.yml`, `tests/platform/**`  
  Acceptance: Core runtime, CLI parsing, state recovery, command execution, and path policy run on all supported host operating systems.

- [ ] **093. `test: enforce coverage thresholds`**  
  Files: `bunfig.toml`, `scripts/check-coverage.ts`, `.github/workflows/ci.yml`  
  Acceptance: Line and function coverage floors apply to safety-critical packages, and changed safety code cannot lower the baseline without an explicit reviewed change.

- [ ] **094. `test: add property and mutation testing gates`**  
  Files: `scripts/run-property-tests.ts`, `scripts/run-mutation-tests.ts`, `tests/property/**`  
  Acceptance: State transitions, parsers, glob rules, path policy, event chain, and report reconciliation are tested beyond fixed examples; surviving critical mutations fail CI.

- [ ] **095. `perf: add runtime and fixture budgets`**  
  Files: `benchmarks/**`, `scripts/check-benchmarks.ts`, `.github/workflows/ci.yml`  
  Acceptance: Startup, plan rendering, 10k event audit, 5k finding query, snapshot, and report generation have recorded budgets with stable fixtures.

- [ ] **096. `security: add dependency code and license gates`**  
  Files: `.github/workflows/security.yml`, `docs/security/dependency-policy.md`  
  Acceptance: Dependency review, code scanning, secret scanning configuration, pinned actions, and allowed-license checks run with least GitHub token permissions.

- [ ] **097. `release: generate SBOM and artifact inventory`**  
  Files: `scripts/generate-sbom.ts`, `.github/workflows/release.yml`, `docs/RELEASING.md`  
  Acceptance: Every package and binary release includes CycloneDX or SPDX SBOM, checksums, file inventory, version, target, and source commit.

- [ ] **098. `release: attest build provenance`**  
  Files: `.github/workflows/release.yml`, `docs/RELEASING.md`  
  Acceptance: Release artifacts receive GitHub provenance attestations from the tagged commit, and verification instructions are published without claiming guarantees unavailable to Bun registry publishing.

- [ ] **099. `release: remove hardcoded versions and add rollback checks`**  
  Files: `scripts/build-release.ts`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `tests/release/versioning.test.ts`  
  Acceptance: Version assertions derive from package metadata; tag, package, extension, binary, and release notes must agree; failed publication leaves no mutable tag or partial release claim.

- [ ] **100. `test: add production-grade acceptance workflow`**  
  Files: `.github/workflows/production-acceptance.yml`, `tests/acceptance/**`, `docs/production-acceptance.md`  
  Acceptance: A clean source checkout builds and installs package and binaries, runs bounded autopilot against web, API, and library seeded fixtures, catches fake repairs, survives interruption, audits evidence, and produces qualified readiness reports.

## Progress record

After each merged item, record its SHA, targeted tests, phase-gate result, and any justified ordering change in `docs/progress/production-backlog-progress.md`. Generated state, `HARDENING.md`, credentials, local paths, logs, package archives, and binaries must not be committed.

## Exit criteria

The program finishes only when all 100 commits are merged and traceable, the Linux/macOS/Windows matrix is green, package and binaries pass clean-install tests, all agent adapters pass the same authority contract, bounded autopilot passes seeded web/API/library fixtures, fake repairs are rejected and rolled back, interrupted runs resume without state loss, `dokion audit` reconciles state/events/evidence/report/repository identity, capability provenance is visible, release artifacts include SBOM/checksums/inventory/provenance, and no report makes an unqualified production-readiness claim.

Implement in numeric order unless a safety dependency must move earlier. Document any order change and preserve exactly 100 implementation commits.
