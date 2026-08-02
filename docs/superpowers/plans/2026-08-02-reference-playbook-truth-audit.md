# Reference Playbook Truth Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Ensure every shipped reference or built-in Playbook is inert, executable only through real catalog capabilities, bounded by defensible authority, and free from claims that are not proven by fixtures and runtime evidence

**Architecture:** Add one reusable Playbook truth auditor over every file under `playbooks/reference/` and `playbooks/builtin/`. The auditor cross-checks Playbook schema, capability catalog, immutable identity, permissions, command support, platform guarantees, success conditions, fixture coverage, and public wording. Invalid reference Playbooks fail CI and distribution validation

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, existing Playbook schema validator, capability catalog, built-in registry, fixture harness, Bun test

## Global Constraints

- A reference Playbook is inert and must never be described as installed, active, verified, or production-ready by presence alone
- Every capability ID must exist in the exact catalog source named by the Playbook
- Every command must be supported by that capability contract or remain an unresolved proposal binding
- Broad `read` or `write` scopes require a documented reason and a fixture proving bounded enforcement
- Subagent, parallel execution, worktree isolation, rollback, and verification claims must match recorded platform guarantees
- Success conditions require an evaluator or evidence contract
- A shell command listed in a Playbook is not proof that Dokion can install or execute the required tool
- `READY_FOR_PRODUCTION` is a project target, not a result or endorsement

---

### Task 1: Inventory every shipped Playbook and its authority

**Files:**
- Create: `src/playbooks/truth-audit/types.ts`
- Create: `src/playbooks/truth-audit/inventory.ts`
- Create: `tests/playbooks/truth-audit-inventory.test.ts`
- Create: `generated/playbook-inventory.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildPlaybookInventory(root: string): Promise<PlaybookInventory>`
- Consumes: `playbooks/reference/**`, `playbooks/builtin/**`, built-in registry, `dokion.json`

- [ ] **Step 1: Write a failing inventory test**

Require every Playbook record to include

- Repository-relative path
- Type `reference` or `builtin`
- Playbook version and digest
- Project target
- Capability IDs and sources
- Immutable references
- Read and write scopes
- Network permission
- Shell commands
- Approval modes
- Claimed success conditions
- Claimed platform behavior
- Fixture path or `unproven`

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/truth-audit-inventory.test.ts`

Expected result: inventory builder and generated file do not exist

- [ ] **Step 3: Implement deterministic inventory generation**

Use no-follow bounded directory traversal

Sort records by path and steps by declared order

Redact credentials from source references

Reject duplicate Playbook IDs and duplicate step IDs

- [ ] **Step 4: Add generation script**

Add

```json
"generate:playbook-inventory": "bun run src/playbooks/truth-audit/inventory.ts"
```

- [ ] **Step 5: Verify deterministic output**

Run generation twice and require byte-identical output

- [ ] **Step 6: Commit**

```bash
git add src/playbooks/truth-audit/types.ts src/playbooks/truth-audit/inventory.ts tests/playbooks/truth-audit-inventory.test.ts generated/playbook-inventory.json package.json
git commit -m "feat: inventory shipped Playbook authority"
```

### Task 2: Cross-check capabilities, commands, and immutable identity

**Files:**
- Create: `src/playbooks/truth-audit/audit-capabilities.ts`
- Create: `src/playbooks/truth-audit/diagnostics.ts`
- Create: `tests/playbooks/truth-audit-capabilities.test.ts`

**Interfaces:**
- Produces: `auditPlaybookCapabilities(playbook, catalog): PlaybookTruthDiagnostic[]`

- [ ] **Step 1: Write failing negative controls**

Cover

- Unknown tool ID
- Unknown Skill ID
- Catalog source mismatch
- Missing immutable reference when required
- `require_digest: false` for a capability that claims pinned execution
- Command absent from the capability contract
- Command requiring an unavailable executable
- Playbook that names a Skill but depends on platform behavior not declared by its adapter
- Floating or placeholder version

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/truth-audit-capabilities.test.ts`

Expected result: no cross-capability auditor exists

- [ ] **Step 3: Implement exact matching**

No fuzzy substitution

No implicit mapping from a package or repository name to a capability ID

No assumption that an agent Skill can execute arbitrary shell commands or launch subagents

- [ ] **Step 4: Add stable diagnostics**

Use codes

```text
PLAYBOOK_CAPABILITY_UNKNOWN
PLAYBOOK_CAPABILITY_SOURCE_MISMATCH
PLAYBOOK_IMMUTABLE_REFERENCE_MISSING
PLAYBOOK_DIGEST_POLICY_WEAK
PLAYBOOK_COMMAND_UNDECLARED
PLAYBOOK_EXECUTABLE_UNPROVEN
PLAYBOOK_PLATFORM_GUARANTEE_UNPROVEN
PLAYBOOK_VERSION_UNPINNED
```

- [ ] **Step 5: Run focused tests**

Run `bun test tests/playbooks/truth-audit-capabilities.test.ts`

Expected result: every capability and command must resolve exactly or fail distribution validation

- [ ] **Step 6: Commit**

```bash
git add src/playbooks/truth-audit/audit-capabilities.ts src/playbooks/truth-audit/diagnostics.ts tests/playbooks/truth-audit-capabilities.test.ts
git commit -m "test: cross-check Playbook capabilities and commands"
```

### Task 3: Audit authority scopes and platform claims

**Files:**
- Create: `src/playbooks/truth-audit/audit-authority.ts`
- Create: `tests/playbooks/truth-audit-authority.test.ts`

**Interfaces:**
- Produces: `auditPlaybookAuthority(playbook, platformContracts): PlaybookTruthDiagnostic[]`

- [ ] **Step 1: Write failing authority tests**

Cover

- `write: ["**/*"]` without explicit justification and fixture enforcement
- Read-only step with a shell command that writes an output file
- Network access without a bounded source policy
- Repair step without a snapshot and rollback contract
- Verification claim without declared required gates
- Subagent claim when no supported adapter proves subagent isolation
- Parallel or swarm wording when `parallel_execution` is false
- Worktree claim when the platform records no worktree isolation
- Approval mode inconsistent with a write step

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/truth-audit-authority.test.ts`

Expected result: no authority auditor exists

- [ ] **Step 3: Implement authority policy**

Define severity levels

- Error blocks package and release
- Warning blocks public promotion until explicitly acknowledged
- Info records a limitation

Require exact evidence links for high-risk scopes and platform behavior

- [ ] **Step 4: Add stable diagnostics**

Use codes

```text
PLAYBOOK_WRITE_SCOPE_OVERBROAD
PLAYBOOK_READ_ONLY_COMMAND_WRITES
PLAYBOOK_NETWORK_POLICY_MISSING
PLAYBOOK_ROLLBACK_UNPROVEN
PLAYBOOK_VERIFICATION_UNPROVEN
PLAYBOOK_SUBAGENT_GUARANTEE_UNPROVEN
PLAYBOOK_PARALLEL_CLAIM_CONTRADICTED
PLAYBOOK_WORKTREE_GUARANTEE_UNPROVEN
PLAYBOOK_APPROVAL_POLICY_WEAK
```

- [ ] **Step 5: Run focused tests**

Run `bun test tests/playbooks/truth-audit-authority.test.ts`

Expected result: dangerous or contradictory authority fails closed

- [ ] **Step 6: Commit**

```bash
git add src/playbooks/truth-audit/audit-authority.ts tests/playbooks/truth-audit-authority.test.ts
git commit -m "test: reject unsafe Playbook authority claims"
```

### Task 4: Require evaluators and fixtures for success claims

**Files:**
- Create: `src/playbooks/truth-audit/audit-success.ts`
- Create: `tests/playbooks/truth-audit-success.test.ts`
- Modify: `src/playbooks/contract-harness.ts`

**Interfaces:**
- Produces: `auditPlaybookSuccessContracts(playbook, fixtureRegistry): PlaybookTruthDiagnostic[]`

- [ ] **Step 1: Write failing success-contract tests**

Cover

- Success condition with no evaluator
- `tests_passing` without exact test command and exit evidence
- `findings_remediated` without finding lifecycle reconciliation
- `ocr_scan_completed` without a scanner adapter and normalized output contract
- Production-ready target presented as a result
- Fixture that passes because the relevant step was skipped
- Fixture that mocks the entire execution boundary

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/truth-audit-success.test.ts`

Expected result: success conditions are not centrally audited

- [ ] **Step 3: Implement evaluator cross-checks**

Every named condition must map to an implemented evaluator or a typed module output contract

Every promoted Playbook must have one passing and one negative fixture through the production engine

- [ ] **Step 4: Detect false-positive fixtures**

Require evidence that commands ran, repository state changed when expected, negative findings remained visible, and readiness did not come from skipped or mocked steps

- [ ] **Step 5: Run focused tests**

Run `bun test tests/playbooks/truth-audit-success.test.ts tests/playbooks/all-builtins.test.ts`

Expected result: unproven success language blocks promotion

- [ ] **Step 6: Commit**

```bash
git add src/playbooks/truth-audit/audit-success.ts tests/playbooks/truth-audit-success.test.ts src/playbooks/contract-harness.ts
git commit -m "test: require evidence for Playbook success conditions"
```

### Task 5: Audit and repair the Open Code Review reference Playbook

**Files:**
- Modify: `playbooks/reference/open-code-review.playbook.json`
- Create: `tests/playbooks/open-code-review-reference.test.ts`
- Add or modify: exact catalog capability records required by the Playbook
- Add fixtures only when the real CLI or adapter can execute in the maintained test environment

**Interfaces:**
- Consumes: real `open-code-review` and `superpowers` capability contracts if present
- Produces: a truthful inert reference or a quarantined unavailable example

- [ ] **Step 1: Write a failing audit test against the current file**

Assert that the current file cannot pass until all of these are proven or removed

- `open-code-review` exact capability availability and version
- `ocr review` command contract
- Structured findings adapter
- `superpowers` exact capability behavior
- Bounded subagent support
- Broad `write: ["**/*"]` scope
- Mixed `bun test`, `npm test`, and `bun run build` commands without project resolution
- `tests_passing` evaluator
- Repair snapshot and rollback contract
- Digest policy compatible with claimed provenance

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/open-code-review-reference.test.ts`

Expected result: current reference fails the truth audit

- [ ] **Step 3: Select one truthful resolution**

Preferred order

1. Bind the Playbook to real catalog capabilities and production adapters with passing fixtures
2. Reduce it to a read-only inert proposal with unresolved repair and verification bindings
3. Move it under a clearly marked experimental or quarantined examples directory excluded from shipped Playbook listings

Do not preserve claims merely because the file is labeled reference

- [ ] **Step 4: Narrow authority**

Resolve project validation commands per repository profile

Replace broad write scope with exact project paths or keep repair unbound

Require digest and provenance according to the selected capability contract

- [ ] **Step 5: Prove passing and blocked behavior**

When real integration is available, run through `ExecutionEngine` against maintained fixtures

When unavailable, prove that the reference remains inert and cannot activate

- [ ] **Step 6: Run focused and full Playbook gates**

Run

```bash
bun test tests/playbooks/open-code-review-reference.test.ts
bun test tests/playbooks/truth-audit-*.test.ts tests/playbooks/all-builtins.test.ts
bun run validate:contracts
bun run validate:distribution
```

Expected result: no unproven integration claim remains in shipped Playbook surfaces

- [ ] **Step 7: Commit**

```bash
git add playbooks/reference/open-code-review.playbook.json tests/playbooks/open-code-review-reference.test.ts dokion.json src tests/fixtures
git commit -m "fix: make Open Code Review reference truthful"
```

### Task 6: Add the truth audit to CI and release validation

**Files:**
- Create: `src/playbooks/truth-audit/run-audit.ts`
- Create: `tests/contracts/playbook-truth-gate.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/validate-distribution.ts`

**Interfaces:**
- Adds: `bun run validate:playbook-truth`
- Produces deterministic JSON diagnostics and human summary

- [ ] **Step 1: Write failing release gate tests**

Require CI and release workflows to run the audit before package smoke or publication

Require generated inventory to be current

- [ ] **Step 2: Implement the combined audit**

Run inventory, capability, authority, and success audits over all shipped Playbooks

Exit non-zero on errors and unacknowledged warnings

- [ ] **Step 3: Add repository scripts and workflow gates**

Add

```json
"validate:playbook-truth": "bun run src/playbooks/truth-audit/run-audit.ts"
```

- [ ] **Step 4: Verify complete gates**

Run

```bash
bun run generate:playbook-inventory
bun run validate:playbook-truth
bun test
bun run typecheck
bun run build
bun run validate:distribution
bun run smoke:package
```

Expected result: a new unsafe reference Playbook cannot merge or publish

- [ ] **Step 5: Commit**

```bash
git add src/playbooks/truth-audit/run-audit.ts tests/contracts/playbook-truth-gate.test.ts package.json .github/workflows/ci.yml .github/workflows/release.yml scripts/validate-distribution.ts generated/playbook-inventory.json
git commit -m "ci: gate shipped Playbooks on truth audit"
```

## PR Completion Gate

The PR is complete only when every shipped Playbook resolves exact capabilities and commands, dangerous scopes have fixture evidence, platform claims match recorded guarantees, success conditions have evaluators, the Open Code Review reference is repaired or quarantined truthfully, CodeRabbit critical and major findings are resolved, and full release gates pass on the final branch head
