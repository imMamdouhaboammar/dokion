# Dokion M4 Adversarial Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repair validation compare the repository immediately before and after each remediation so untracked files, suppression directives, fake regression-test claims, and failed repairs cannot escape detection or remain in the worktree.

**Architecture:** Capture an immutable per-finding worktree snapshot immediately before the declared remediation command. Validate the post-command tree against that snapshot rather than against `HEAD`, produce a delta artifact from the changed paths, and restore the exact snapshot when validation or verification fails. Keep the playbook immutable and execute only commands already declared in `permissions.shell`.

**Tech Stack:** TypeScript 7, Bun 1.3.14, Bun test, Git.

## Global Constraints

- `.dokion/playbook.json` is never written by Dokion.
- No capability is selected, installed, substituted, reordered, or enabled by the runtime.
- Every remediation command must already exist in the active step's `permissions.shell`.
- Snapshot and evidence files live only under `.dokion/`.
- A repair reaches `VERIFIED` only after adversarial validation and every declared verification command pass.
- Any rejected or unverified repair restores the exact pre-remediation worktree state.
- Tests are written before production changes.

---

### Task 1: Define failing M4 adversary tests

**Files:**
- Create: `tests/m4-adversarial-validation.test.ts`
- Reuse: `tests/m3-capability-remediation.test.ts`

**Interfaces:**
- Consumes: `ExecutionEngine.run()`, `listFindings(root)`, `readFinding(root, id)`.
- Produces: regression coverage for snapshot-based repair validation.

- [ ] Add a fixture remediation that creates `outside.txt` outside `permissions.write`; assert the run fails, the finding is `REPAIR_REJECTED`, and the file is removed.
- [ ] Add a fixture remediation that creates an untracked source file containing `// nosec`; assert `FIX_IS_SUPPRESSION` and exact rollback.
- [ ] Add a fixture with a pre-existing unrelated dirty file; assert a valid repair preserves that file byte-for-byte.
- [ ] Add a fixture where a valid source repair changes no test file while `require_regression_test: true`; assert rejection even though an old test already exists.
- [ ] Add a fixture whose verification command fails; assert the source tree is restored to the pre-remediation snapshot.
- [ ] Run `bun test tests/m4-adversarial-validation.test.ts` and confirm failures are caused by current `git diff` and `findRegressionTest` behavior.
- [ ] Commit the red tests.

### Task 2: Capture and restore exact repair snapshots

**Files:**
- Create: `src/validation/repair-snapshot.ts`
- Test: `tests/m4-adversarial-validation.test.ts`

**Interfaces:**
- Produces: `captureRepairSnapshot(root): Promise<RepairSnapshot>`.
- Produces: `diffRepairSnapshots(before, after): RepairDelta`.
- Produces: `restoreRepairSnapshot(root, before, delta): Promise<void>`.
- `RepairSnapshot.files` maps repository-relative paths to `{ kind, digest, content?, target?, mode? }`.
- `RepairDelta` exposes `changedPaths`, `addedPaths`, `modifiedPaths`, `deletedPaths`, and `changedTestPaths`.

- [ ] Enumerate tracked and untracked non-ignored paths with `git ls-files -z --cached --others --exclude-standard`.
- [ ] Exclude `.git/**`, `.dokion/**`, and `HARDENING.md` from source snapshots.
- [ ] Store regular-file bytes, symlink targets, executable mode, and SHA-256 digests.
- [ ] Compare snapshots without consulting `HEAD`.
- [ ] Restore modified/deleted files from snapshot bytes, recreate symlinks, restore executable mode, and remove paths absent from the baseline.
- [ ] Run the focused tests and commit.

### Task 3: Validate the repair delta, including untracked files

**Files:**
- Modify: `src/validation/repair-validator.ts`
- Test: `tests/m4-adversarial-validation.test.ts`

**Interfaces:**
- `validateRepair` consumes `before: RepairSnapshot`.
- `RepairValidationResult` adds `changedTestPaths` and `after: RepairSnapshot`.
- `validateRepair` returns `FIX_IS_SUPPRESSION` when suppression-pattern counts increase between snapshots.

- [ ] Replace `git diff --name-status` as the source of changed paths with `diffRepairSnapshots`.
- [ ] Apply write-scope checks to every added, modified, and deleted path, including untracked files.
- [ ] Detect new suppression directives by comparing pattern counts in baseline and post-repair text.
- [ ] Treat added or modified test files as regression-test evidence; an unchanged historical test does not qualify.
- [ ] Reject deleted tests and added skip/todo directives.
- [ ] Render a deterministic repair delta artifact that includes path status and textual before/after content for changed text files.
- [ ] Run focused tests and commit.

### Task 4: Integrate snapshots into remediation lifecycle

**Files:**
- Modify: `src/engine/capability-runner.ts`
- Delete internal helper: `findRegressionTest`.
- Replace internal helper: `rollbackTrackedChanges`.
- Test: `tests/m3-capability-remediation.test.ts`
- Test: `tests/m4-adversarial-validation.test.ts`

**Interfaces:**
- Capture the snapshot immediately before invoking the declared remediation command.
- Pass the baseline snapshot to `validateRepair`.
- Use `validation.changedTestPaths[0]` as the recorded regression test.

- [ ] Restore the snapshot when remediation exits non-zero after it changed files.
- [ ] Restore the snapshot when adversarial validation rejects the repair.
- [ ] Restore the snapshot when any declared verification command exits non-zero.
- [ ] Remove the project-wide glob that accepted any existing test as regression evidence.
- [ ] Preserve existing M3 approval and evidence behavior.
- [ ] Run `bun test tests/m3-capability-remediation.test.ts tests/m4-adversarial-validation.test.ts` and commit.

### Task 5: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `templates/BUILD_PROMPT.md`

**Interfaces:**
- README reports M0-M4 as implemented and names the remaining M5-M6 work.
- M4 acceptance vocabulary uses `REPAIR_REJECTED`, matching the schema.

- [ ] Remove the stale `Spec-Stage Repository` notice.
- [ ] Document snapshot-based validation, untracked-file coverage, exact rollback, and changed-test evidence.
- [ ] Replace the stale `REJECTED_BY_VALIDATION` wording with `REPAIR_REJECTED`.
- [ ] Run `bun test`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run validate:contracts`.
- [ ] Run `bun run build`.
- [ ] Open a pull request containing exact CI evidence.
