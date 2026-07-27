# State Integrity, Recovery, and Secure Execution Backlog

## Scope

This workstream prevents concurrent or stale execution and contains every external side effect. Recovery must be deterministic and repairs must be reversible before mutation begins.

## Task format

Each task is a reviewable delivery unit. P0 blocks public-beta promotion. P1 blocks the broader production-grade claim unless the corresponding surface is explicitly excluded.

## Backlog

### STATE-001 Add exclusive project run locking

- Priority: P0
- Depends on: None
- Primary files: `src/state/run-lock.ts`
- Verification: `tests/state/run-lock.test.ts`
- Deliverable: Create a lock with process identity, run identity, timestamp, host, and recovery metadata for run, resume, step, reset, verify, and autopilot.
- Acceptance: A second live process is blocked; stale locks require an explicit recorded recovery path and cannot be silently overwritten.

### STATE-002 Add monotonic revisions and compare-and-swap

- Priority: P0
- Depends on: None
- Primary files: `src/state/state-store.ts; src/state/types.ts; schemas/dokion-state.schema.json`
- Verification: `tests/state/revision.test.ts`
- Deliverable: Increment a state revision on every accepted transition and require callers to update from the expected revision.
- Acceptance: Stale writers fail with a stable conflict error and cannot overwrite newer state.

### STATE-003 Validate typed event records

- Priority: P0
- Depends on: STATE-002
- Primary files: `schemas/dokion-event.schema.json; src/state/event-log.ts`
- Verification: `tests/state/event-schema.test.ts`
- Deliverable: Add schema version, sequence, actor, run, timestamp, event type, and typed payload to every event.
- Acceptance: Invalid events are rejected before append and sequence remains monotonic for one run.

### STATE-004 Hash-chain the append-only event journal

- Priority: P0
- Depends on: STATE-003
- Primary files: `src/state/event-chain.ts; src/state/event-log.ts`
- Verification: `tests/state/event-chain.test.ts`
- Deliverable: Add previous and current digest fields and a verifier that detects deletion, insertion, modification, truncation, and cross-run splicing.
- Acceptance: Journal verification fails closed and reports the first invalid sequence without rewriting evidence.

### STATE-005 Recover interrupted atomic writes

- Priority: P0
- Depends on: STATE-002
- Primary files: `src/core/atomic-file.ts; src/state/state-store.ts`
- Verification: `tests/state/atomic-recovery.test.ts`
- Deliverable: Resolve or quarantine temporary state, lock, report, approval, finding, and transaction files at startup.
- Acceptance: Partial or conflicting JSON is never silently accepted; recovery choices are deterministic and recorded.

### STATE-006 Bind runs to repository identity

- Priority: P0
- Depends on: STATE-002
- Primary files: `src/git/repository-identity.ts; src/engine/runtime-engine.ts`
- Verification: `tests/state/resume-identity.test.ts`
- Deliverable: Capture canonical root, remote identity when present, commit, branch, worktree identity, and playbook digest at run start and resume.
- Acceptance: A material identity change blocks continuation or produces a typed stale-run review decision.

### STATE-007 Enforce declared dirty-worktree policy

- Priority: P0
- Depends on: STATE-006
- Primary files: `src/git/worktree-policy.ts; schemas/dokion-playbook.schema.json`
- Verification: `tests/state/worktree-policy.test.ts`
- Deliverable: Support clean-only, allow-existing-dirty, and snapshot-existing-dirty with clean-only as the default for writes.
- Acceptance: Pre-existing changes are distinguished from Dokion changes and write-capable work blocks when policy cannot preserve rollback.

### STATE-008 Handle termination signals safely

- Priority: P0
- Depends on: STATE-001, STATE-009, EXEC-005
- Primary files: `src/runtime/signal-handler.ts; src/engine/runtime-engine.ts`
- Verification: `tests/state/signal-recovery.test.ts`
- Deliverable: On SIGINT and SIGTERM, stop child work, persist a checkpoint, append an interruption event, release or mark the lock, and leave the run resumable.
- Acceptance: No child process survives, no completed action is repeated, and state clearly distinguishes interrupted from failed.

### STATE-009 Checkpoint every external side effect

- Priority: P0
- Depends on: STATE-002, STATE-003
- Primary files: `src/state/checkpoint.ts; src/engine/runtime-engine.ts`
- Verification: `tests/state/checkpoint.test.ts`
- Deliverable: Persist intent before command, repair, rollback, approval wait, report write, activation, and release-related action, then persist completion.
- Acceptance: Recovery can distinguish not-started, started-unknown, and completed outcomes for every side effect.

### STATE-010 Add versioned state migrations

- Priority: P1
- Depends on: STATE-002, STATE-005
- Primary files: `src/state/migrations/**; src/state/load-state.ts`
- Verification: `tests/state/migrations.test.ts`
- Deliverable: Load supported older schemas through explicit pure migrations and reject unknown future versions without rewriting data.
- Acceptance: Every migration has fixture coverage, preserves evidence references, and records source and target versions.

### EXEC-001 Add platform command strategies

- Priority: P0
- Depends on: CAP-002
- Primary files: `src/execution/command-strategy.ts; src/execution/platform-shell.ts`
- Verification: `tests/execution/platform-shell.test.ts`
- Deliverable: Use an explicit POSIX shell strategy for claimed Linux and macOS surfaces and a compatible explicit strategy for Windows.
- Acceptance: Unsupported shells fail before execution and platform degradations are reported rather than bypassed.

### EXEC-002 Support argument-vector commands

- Priority: P0
- Depends on: EXEC-001
- Primary files: `src/execution/command-spec.ts; schemas/dokion-playbook.schema.json`
- Verification: `tests/execution/command-spec.test.ts`
- Deliverable: Allow executable plus argument array declarations and retain legacy shell strings as explicit higher-risk commands.
- Acceptance: Argument vectors bypass shell parsing; command identity and arguments remain visible and separately escaped in evidence.

### EXEC-003 Restrict command environments

- Priority: P0
- Depends on: CAP-006, EXEC-001
- Primary files: `src/execution/environment-policy.ts; src/engine/command-runner.ts`
- Verification: `tests/execution/environment-policy.test.ts`
- Deliverable: Build an allowlisted child environment from platform-safe defaults and explicitly declared variables.
- Acceptance: Dangerous loader variables are denied, undeclared values are absent, and redaction applies to stdout, stderr, events, evidence, reports, and errors.

### EXEC-004 Spool bounded command output

- Priority: P0
- Depends on: EXEC-001, EVID-008
- Primary files: `src/execution/output-spool.ts; src/engine/command-runner.ts`
- Verification: `tests/execution/output-spool.test.ts`
- Deliverable: Stream stdout and stderr to evidence artifacts with byte limits, digests, truncation markers, and small in-memory summaries.
- Acceptance: Large output cannot exhaust memory; truncation is explicit and full evidence limits participate in run budgets.

### EXEC-005 Terminate complete process trees

- Priority: P0
- Depends on: EXEC-001
- Primary files: `src/execution/process-controller.ts; src/engine/command-runner.ts`
- Verification: `tests/execution/process-controller.test.ts`
- Deliverable: Track process groups and terminate descendants on timeout, signal, cancellation, budget stop, or policy stop.
- Acceptance: Supported platforms prove descendant termination and record reason, timing, exit status, and unsupported guarantees.

### EXEC-006 Canonicalize every read and write scope

- Priority: P0
- Depends on: STATE-006
- Primary files: `src/security/path-policy.ts; src/validation/repair-validator.ts`
- Verification: `tests/security/path-policy.test.ts`
- Deliverable: Reject absolute escapes, parent traversal, alternate separators, case-fold collisions, symlink escapes, root replacement, and unsupported filesystem guarantees.
- Acceptance: Policy decisions use canonical repository-relative paths and record the attempted and declared scopes.

### EXEC-007 Cover bounded ignored files in repair snapshots

- Priority: P0
- Depends on: EXEC-006
- Primary files: `src/validation/ignored-file-policy.ts; src/validation/repair-snapshot.ts`
- Verification: `tests/validation/ignored-files.test.ts`
- Deliverable: Allow explicit ignored paths with file-count and byte limits while excluding dependency trees, caches, credentials, and generated bulk directories by default.
- Acceptance: Declared ignored files participate in before/after/rollback evidence and cap exhaustion blocks before mutation.

### EXEC-008 Handle binary and large repair files

- Priority: P0
- Depends on: EXEC-006
- Primary files: `src/validation/file-snapshot.ts`
- Verification: `tests/validation/binary-snapshot.test.ts`
- Deliverable: Snapshot supported binary and oversized files through metadata, digests, bounded copies, and explicit rollback capability checks.
- Acceptance: Lossy text conversion is impossible and unsupported exact rollback blocks the repair before execution.

### EXEC-009 Persist repair transaction manifests

- Priority: P0
- Depends on: STATE-009, EXEC-006, EXEC-008
- Primary files: `src/validation/repair-transaction.ts; src/engine/capability-runner.ts`
- Verification: `tests/validation/repair-transaction.test.ts`
- Deliverable: Link before snapshot, command, after snapshot, diff, validation, verification, rollback, digests, changed paths, and final disposition.
- Acceptance: Every repair has one auditable transaction record and incomplete transactions are recoverable or blocked.

### EXEC-010 Fuzz repair and scope boundaries

- Priority: P1
- Depends on: EXEC-006, EXEC-007, EXEC-008, EXEC-009
- Primary files: `tests/validation/repair-validator.fuzz.test.ts; tests/fixtures/repair-adversary/**`
- Verification: `tests/validation/repair-validator.fuzz.test.ts`
- Deliverable: Run seeded and generated cases for globs, Unicode, symlinks, case behavior, ignored files, binaries, suppression, test weakening, large diffs, and rollback.
- Acceptance: The suite is deterministic by seed, preserves failing cases, and blocks any bypass of scope or verification policy.
