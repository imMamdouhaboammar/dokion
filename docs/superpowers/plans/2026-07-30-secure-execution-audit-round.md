# Dokion Secure Execution and Audit Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Every behavior change follows RED, GREEN, REFACTOR.

**Goal:** Implement the next public-beta P0 slice covering capability provenance, secure execution, repair transactions, evidence manifests, deterministic reports, and independent audit.

**Architecture:** Foundational modules are isolated by responsibility and landed before four integration tasks. Capability audit, command execution, repair validation, and reporting depend only on typed interfaces from the foundation wave. Signal recovery and independent audit land last because they require integrated process control and evidence surfaces.

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, Ajv 8.20.0, JSON Schema, Git.

## Global Constraints

- `.dokion/playbook.json` is the sole execution authority and must not be edited.
- Bun is mandatory. Do not use npm, pnpm, yarn, or an alternate runtime.
- No new runtime dependency without explicit user approval.
- Subagents must not run `git add`, `git commit`, `git merge`, `git rebase`, or `git push`.
- Tests must be written first and observed failing for the intended reason.
- Secret values and private absolute paths must not appear in state, evidence, reports, logs, or errors.
- Existing authority, append-only evidence, exact rollback, and approval invariants must remain intact.
- Task-local verification is the focused test plus `bun run typecheck`.
- Wave verification is `bun test`, `bun run typecheck`, `bun run validate:contracts`, and `bun run build`.
- Final verification also includes `bun run validate:distribution` and `bun run smoke:package`.

## Execution Waves

- Wave A: isolated foundation tasks 01, 02, 03, 05, 06, 07, 08, 09, 10, 12, 13, 14, 15, 18, 19, 20, 21, 22.
- Wave B: integration tasks 04, 11, 16, 23 after their foundations land.
- Wave C: signal recovery task 17 and audit CLI task 24 after Wave B.

### Task 01: CAP-005 Package Provenance (CAP-005)

**Files:**
- Modify or create: `src/capability/package-provenance.ts`
- Test: `tests/capability/package-provenance.test.ts`

**Interface:** `recordPackageProvenance(input: PackageProvenanceInput): PackageProvenanceRecord`

**Required behavior:** Record package manager, registry, package, version, integrity, installer command, exception reason, approval, and verifier. Redact credentials and reject non-Bun installer exceptions without explicit approval.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/capability/package-provenance.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/capability/package-provenance.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 02: CAP-006 Environment Prerequisite Audit (CAP-006)

**Files:**
- Modify or create: `src/capability/environment-check.ts`
- Test: `tests/capability/environment-check.test.ts`

**Interface:** `checkEnvironmentPrerequisites(requirements, environment): EnvironmentCheckResult`

**Required behavior:** Check only declared variable names and allowed value shapes. Return presence and validation status without returning raw values. Deny dangerous loader variables by default.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/capability/environment-check.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/capability/environment-check.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 03: CAP-007 Capability Conflict Detection (CAP-007)

**Files:**
- Modify or create: `src/capability/conflict-detector.ts`
- Test: `tests/capability/conflict-detector.test.ts`

**Interface:** `detectCapabilityConflicts(capabilities, platform): CapabilityConflict[]`

**Required behavior:** Detect incompatible versions, duplicate responsibility, overlapping write scopes in unsafe parallel stages, and platform incompatibility. Never auto-resolve by substitution or reordering.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/capability/conflict-detector.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/capability/conflict-detector.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 04: CAP-008 Deterministic Doctor Integration (CAP-008)

    **Files:**
    - Modify or create: `src/inspect/doctor.ts`
- Modify or create: `src/cli/handlers/doctor.ts`
    - Test: `tests/cli/doctor.test.ts`

    **Interface:** `runDoctorAudit(root: string): Promise<DoctorAuditReport>`

    **Required behavior:** Integrate provenance, prerequisite, digest, availability, conflict, and degradation checks into a read-only deterministic doctor report with blocking and warning severity.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/cli/doctor.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/cli/doctor.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 05: STATE-009 Side-Effect Checkpoint Store (STATE-009)

**Files:**
- Modify or create: `src/state/checkpoint.ts`
- Test: `tests/state/checkpoint.test.ts`

**Interface:** `beginSideEffect(root, intent): Promise<SideEffectCheckpoint>; completeSideEffect(root, id, outcome): Promise<SideEffectCheckpoint>`

**Required behavior:** Persist intent before external action and completion afterward with stable IDs, monotonic state transitions, atomic writes, and STARTED_UNKNOWN recovery semantics.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/state/checkpoint.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/state/checkpoint.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 06: EXEC-001 Platform Command Strategy (EXEC-001)

**Files:**
- Modify or create: `src/execution/command-strategy.ts`
- Test: `tests/execution/command-strategy.test.ts`

**Interface:** `resolveCommandStrategy(platform, command): CommandStrategyResult`

**Required behavior:** Return explicit POSIX behavior for macOS and Linux, explicit unsupported or degraded results for unproven platforms, and no silent shell fallback.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/execution/command-strategy.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/execution/command-strategy.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 07: EXEC-002 Argument-Vector Command Specification (EXEC-002)

    **Files:**
    - Modify or create: `src/execution/command-spec.ts`
- Modify or create: `schemas/dokion-playbook.schema.json`
    - Test: `tests/execution/command-spec.test.ts`

    **Interface:** `normalizeCommandSpec(input): NormalizedCommandSpec`

    **Required behavior:** Support executable plus argument array and retain legacy shell strings as explicit high-risk specs. Reject mixed or empty forms and preserve executable and arguments separately.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/execution/command-spec.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/execution/command-spec.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 08: EXEC-003 Child Environment Policy (EXEC-003)

**Files:**
- Modify or create: `src/execution/environment-policy.ts`
- Test: `tests/execution/environment-policy.test.ts`

**Interface:** `buildChildEnvironment(input): ChildEnvironmentResult`

**Required behavior:** Construct an allowlisted child environment from platform-safe defaults and declared variables. Deny loader injection variables and expose redaction tokens without secret values.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/execution/environment-policy.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/execution/environment-policy.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 09: EXEC-004 Bounded Output Evidence Spool (EXEC-004)

**Files:**
- Modify or create: `src/execution/output-spool.ts`
- Test: `tests/execution/output-spool.test.ts`

**Interface:** `spoolOutput(stream, options): Promise<OutputSpoolResult>`

**Required behavior:** Stream bytes to an evidence artifact with digest, size, truncation marker, media type, and bounded in-memory summary. Never buffer unbounded output.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/execution/output-spool.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/execution/output-spool.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 10: EXEC-005 Process Tree Controller (EXEC-005)

**Files:**
- Modify or create: `src/execution/process-controller.ts`
- Test: `tests/execution/process-controller.test.ts`

**Interface:** `terminateProcessTree(handle, reason, options): Promise<ProcessTerminationResult>`

**Required behavior:** Track process group identity and terminate descendants using SIGTERM then bounded SIGKILL on supported POSIX hosts. Record reason, timing, exit status, and degraded guarantees.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/execution/process-controller.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/execution/process-controller.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 11: Secure Command Runner Integration (EXEC-001..005)

**Files:**
- Modify or create: `src/engine/command-runner.ts`
- Test: `tests/execution/secure-command-runner.test.ts`

**Interface:** `runCommand(root, commandSpec, options): Promise<CommandResult>`

**Required behavior:** Integrate command strategy, normalized specs, child environment policy, bounded output spooling, timeout handling, and process-tree termination while preserving legacy callers.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/execution/secure-command-runner.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/execution/secure-command-runner.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 12: EXEC-006 Canonical Repository Path Policy (EXEC-006)

**Files:**
- Modify or create: `src/security/path-policy.ts`
- Test: `tests/security/path-policy.test.ts`

**Interface:** `evaluateRepositoryPath(root, requested, declaredScopes, options): Promise<PathPolicyDecision>`

**Required behavior:** Reject absolute escapes, parent traversal, alternate separators, symlink escapes, root replacement, and case-fold collisions. Return canonical repository-relative paths and exact denial reasons.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/security/path-policy.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/security/path-policy.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 13: EXEC-007 Bounded Ignored-File Policy (EXEC-007)

**Files:**
- Modify or create: `src/validation/ignored-file-policy.ts`
- Test: `tests/validation/ignored-files.test.ts`

**Interface:** `collectDeclaredIgnoredFiles(root, policy): Promise<IgnoredFileCollection>`

**Required behavior:** Include only explicitly declared ignored paths within file-count and byte limits. Exclude dependency trees, caches, credentials, and generated bulk directories by default.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/validation/ignored-files.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/validation/ignored-files.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 14: EXEC-008 Binary and Large File Snapshot (EXEC-008)

**Files:**
- Modify or create: `src/validation/file-snapshot.ts`
- Test: `tests/validation/binary-snapshot.test.ts`

**Interface:** `captureFileSnapshot(path, options): Promise<FileSnapshot>`

**Required behavior:** Detect text versus binary without lossy conversion, record metadata and digest, copy exact bytes only within bounds, and fail before mutation when exact rollback cannot be proven.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/validation/binary-snapshot.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/validation/binary-snapshot.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 15: EXEC-009 Repair Transaction Manifest (EXEC-009)

**Files:**
- Modify or create: `src/validation/repair-transaction.ts`
- Test: `tests/validation/repair-transaction.test.ts`

**Interface:** `createRepairTransaction(input): RepairTransaction; advanceRepairTransaction(transaction, event): RepairTransaction`

**Required behavior:** Represent before snapshot, command, after snapshot, diff, validation, verification, rollback, digests, changed paths, checkpoints, and final disposition in one versioned transaction.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/validation/repair-transaction.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/validation/repair-transaction.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 16: Repair Pipeline Transaction Integration (EXEC-006..009)

    **Files:**
    - Modify or create: `src/validation/repair-snapshot.ts`
- Modify or create: `src/validation/repair-validator.ts`
- Modify or create: `src/engine/capability-runner.ts`
    - Test: `tests/validation/repair-pipeline-transaction.test.ts`

    **Interface:** `execute repair through canonical path policy and transaction manifest`

    **Required behavior:** Integrate canonical scopes, ignored files, binary snapshot capability, checkpoints, and repair transaction persistence without weakening existing suppression, regression-test, or rollback checks.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/validation/repair-pipeline-transaction.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/validation/repair-pipeline-transaction.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 17: STATE-008 Safe Signal Interruption (STATE-008)

    **Files:**
    - Modify or create: `src/runtime/signal-handler.ts`
- Modify or create: `src/engine/runtime-engine.ts`
    - Test: `tests/state/signal-recovery.test.ts`

    **Interface:** `installSignalHandler(context): SignalHandlerController`

    **Required behavior:** On SIGINT or SIGTERM, cancel child work, checkpoint interruption, append a typed event, mark or release the run lock, and leave a resumable non-failed state without replaying completed actions.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/state/signal-recovery.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/state/signal-recovery.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 18: EVID-001 Completion Criterion Evaluator (EVID-001)

    **Files:**
    - Modify or create: `src/readiness/completion.ts`
- Modify or create: `schemas/dokion-state.schema.json`
    - Test: `tests/readiness/completion.test.ts`

    **Interface:** `evaluateCompletion(input): CompletionEvaluation`

    **Required behavior:** Store PASS, FAIL, BLOCKED, or NOT_APPLICABLE for every criterion with evaluator version, evidence references, and freshness. Missing required criteria prevent completion.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/readiness/completion.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/readiness/completion.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 19: EVID-002 Qualified Readiness Statement (EVID-002)

**Files:**
- Modify or create: `src/readiness/readiness-statement.ts`
- Test: `tests/readiness/statement.test.ts`

**Interface:** `formatReadinessStatement(input): QualifiedReadinessStatement`

**Required behavior:** Tie wording to subject, commit, playbook digest, lock digest, gates, coverage, degradations, exclusions, and timestamp. Reject unqualified production-ready language.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/readiness/statement.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/readiness/statement.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 20: EVID-003 Declared Execution Report Section (EVID-003)

**Files:**
- Modify or create: `src/report/sections/execution.ts`
- Test: `tests/report/execution-section.test.ts`

**Interface:** `renderExecutionSection(input): ExecutionSection`

**Required behavior:** List every stage and step in declared order with actual disposition, capability identity, version, digest, attempts, and evidence. Keep skipped, blocked, failed, and unexecuted work visible.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/report/execution-section.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/report/execution-section.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 21: EVID-004 Exceptions Report Section (EVID-004)

**Files:**
- Modify or create: `src/report/sections/exceptions.ts`
- Test: `tests/report/exceptions-section.test.ts`

**Interface:** `renderExceptionsSection(input): ExceptionsSection`

**Required behavior:** Render skips, manual reviews, accepted risks, deferrals, blocked lanes, stale evidence, degradations, and inert recommendations with actor and reason.

- [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
- [ ] Run `bun test tests/report/exceptions-section.test.ts` and confirm RED is caused by missing behavior, not setup failure.
- [ ] Implement the smallest typed solution consistent with existing repository patterns.
- [ ] Run `bun test tests/report/exceptions-section.test.ts` and `bun run typecheck` until both pass.
- [ ] Review `git diff --check` and confirm no file outside the task scope changed.
- [ ] Write the task report. Do not stage or commit changes.

---

### Task 22: EVID-008 Evidence Manifest and Checksums (EVID-008)

    **Files:**
    - Modify or create: `src/evidence/manifest.ts`
- Modify or create: `schemas/dokion-evidence-manifest.schema.json`
    - Test: `tests/evidence/manifest.test.ts`

    **Interface:** `buildEvidenceManifest(root, metadata): Promise<EvidenceManifest>; verifyEvidenceManifest(root, manifest): Promise<EvidenceManifestVerification>`

    **Required behavior:** Create a sorted manifest with path, size, media type, digest, producer, run, commit, redaction status, and retention class. Detect missing, altered, duplicate, cross-run, and required unmanifested evidence.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/evidence/manifest.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/evidence/manifest.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 23: EVID-005 Deterministic JSON Report (EVID-005)

    **Files:**
    - Modify or create: `src/report/json-report.ts`
- Modify or create: `schemas/dokion-report.schema.json`
    - Test: `tests/report/json-report.test.ts`

    **Interface:** `buildJsonReport(input): DokionJsonReport`

    **Required behavior:** Combine completion, qualified statement, execution, exceptions, gates, coverage, findings, and evidence into a schema-valid stable report using repository-relative paths and no secrets.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/report/json-report.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/report/json-report.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.

---

### Task 24: EVID-010 Independent Audit CLI (EVID-010)

    **Files:**
    - Modify or create: `src/audit/audit-run.ts`
- Modify or create: `src/cli/handlers/audit.ts`
- Modify or create: `src/cli/command-registry.ts`
- Modify or create: `src/cli/parser.ts`
- Modify or create: `src/cli/types.ts`
- Modify or create: `src/cli.ts`
    - Test: `tests/audit/audit-run.test.ts`
- Test: `tests/cli/audit.test.ts`

    **Interface:** `auditRun(root: string): Promise<AuditResult>`

    **Required behavior:** Add read-only dokion audit verification for schemas, revision, event chain, repository identity, playbook and lock digests, approvals, transactions, evidence manifest, JSON report, and completion with stable exit semantics.

    - [ ] Write focused failing tests that exercise the public interface and the listed safety boundary.
    - [ ] Run `bun test tests/audit/audit-run.test.ts tests/cli/audit.test.ts` and confirm RED is caused by missing behavior, not setup failure.
    - [ ] Implement the smallest typed solution consistent with existing repository patterns.
    - [ ] Run `bun test tests/audit/audit-run.test.ts tests/cli/audit.test.ts` and `bun run typecheck` until both pass.
    - [ ] Review `git diff --check` and confirm no file outside the task scope changed.
    - [ ] Write the task report. Do not stage or commit changes.
