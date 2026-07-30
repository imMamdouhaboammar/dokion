# Dokion Bounded Autopilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the deterministic Bounded Autopilot runtime, playbook registry, capability lock system, process isolation, and evidence reporting for Dokion.

**Architecture:** Bounded Autopilot extends Dokion's state-integrity layer with deterministic next-action evaluation, strict approval & failure policy guards, execution budgets, isolated subprocess execution, and standardized evidence exports (SARIF/JUnit).

**Tech Stack:** Bun 1.3.14+, TypeScript 7.0.2, Ajv JSON Schema validator.

## Global Constraints

- Engine: Bun 1.3.14+ mandatory for execution and tests (`bun test`).
- Type safety: Strict TypeScript (`tsc --noEmit`).
- Immutability & Authority: `.dokion/playbook.json` is sole execution authority.
- No git commits by subagents; git commits reserved solely for Orchestrator upon passing QA.

---

### Task 01: Core Next-Action Selector (`CORE-001`)

**Files:**
- Create: `src/autopilot/next-action.ts`
- Create: `src/autopilot/types.ts`
- Test: `tests/autopilot/next-action.test.ts`

**Interfaces:**
- Produces: `selectNextAction(state: DokionState, playbook: DokionPlaybook): NextActionResult`

- [ ] **Step 1: Write failing test for next action selection**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/next-action.test.ts`)
- [ ] **Step 3: Implement next-action selection logic in `src/autopilot/next-action.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/next-action.test.ts`)

---

### Task 02: Centralized Approval Policy Evaluator (`CORE-002`)

**Files:**
- Create: `src/policy/approval-policy.ts`
- Test: `tests/autopilot/approval-boundary.test.ts`

**Interfaces:**
- Produces: `evaluateApprovalBoundary(context: ApprovalContext): ApprovalDecision`

- [ ] **Step 1: Write failing test for approval boundaries**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/approval-boundary.test.ts`)
- [ ] **Step 3: Implement approval evaluator in `src/policy/approval-policy.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/approval-boundary.test.ts`)

---

### Task 03: Failure Policy Transition Engine (`CORE-003`)

**Files:**
- Create: `src/policy/failure-policy.ts`
- Test: `tests/autopilot/failure-policy.test.ts`

**Interfaces:**
- Produces: `evaluateFailureTransition(context: FailureContext): FailureTransitionResult`

- [ ] **Step 1: Write failing test for failure policies**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/failure-policy.test.ts`)
- [ ] **Step 3: Implement failure policy transitions in `src/policy/failure-policy.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/failure-policy.test.ts`)

---

### Task 04: Bounded Retry Scheduler (`CORE-004`)

**Files:**
- Create: `src/autopilot/retry-policy.ts`
- Test: `tests/autopilot/retry-policy.test.ts`

**Interfaces:**
- Produces: `evaluateRetryEligibility(context: RetryContext): RetryDecision`

- [ ] **Step 1: Write failing test for retry scheduling**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/retry-policy.test.ts`)
- [ ] **Step 3: Implement retry policy logic in `src/autopilot/retry-policy.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/retry-policy.test.ts`)

---

### Task 05: Run Budget Evaluator (`CORE-005`)

**Files:**
- Create: `src/autopilot/run-budget.ts`
- Test: `tests/autopilot/run-budget.test.ts`

**Interfaces:**
- Produces: `checkRunBudgets(usage: BudgetUsage, limits: BudgetLimits): BudgetCheckResult`

- [ ] **Step 1: Write failing test for run budgets**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/run-budget.test.ts`)
- [ ] **Step 3: Implement budget evaluation in `src/autopilot/run-budget.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/run-budget.test.ts`)

---

### Task 06: Autopilot Command Handler & Engine (`CORE-006`)

**Files:**
- Create: `src/cli/handlers/autopilot.ts`
- Create: `src/autopilot/run-autopilot.ts`
- Test: `tests/autopilot/command.test.ts`

**Interfaces:**
- Produces: `runAutopilotCommand(options: AutopilotOptions): Promise<AutopilotRunResult>`

- [ ] **Step 1: Write failing test for autopilot command**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/command.test.ts`)
- [ ] **Step 3: Implement autopilot runner and CLI handler**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/command.test.ts`)

---

### Task 07: Dry-Run Decision Tracer (`CORE-007`)

**Files:**
- Create: `src/autopilot/trace.ts`
- Test: `tests/autopilot/dry-run.test.ts`

**Interfaces:**
- Produces: `generateDryRunTrace(state: DokionState, playbook: DokionPlaybook): DecisionTrace`

- [ ] **Step 1: Write failing test for dry-run tracing**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/dry-run.test.ts`)
- [ ] **Step 3: Implement dry-run tracer in `src/autopilot/trace.ts`**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/dry-run.test.ts`)

---

### Task 08: Guarded Step Execution CLI (`CORE-008`)

**Files:**
- Create: `src/engine/step-executor.ts`
- Create: `src/cli/handlers/step.ts`
- Test: `tests/cli/step.test.ts`

**Interfaces:**
- Produces: `executeGuardedStep(stepId: string, options: StepOptions): Promise<StepExecutionResult>`

- [ ] **Step 1: Write failing test for single-step execution**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/step.test.ts`)
- [ ] **Step 3: Implement guarded step execution engine and CLI handler**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/step.test.ts`)

---

### Task 09: Auditable Skip Decision Store (`CORE-009`)

**Files:**
- Create: `src/approvals/skip-store.ts`
- Create: `src/cli/handlers/skip.ts`
- Test: `tests/cli/skip.test.ts`

**Interfaces:**
- Produces: `recordStepSkip(stepId: string, reason: string, actor: string): SkipRecord`

- [ ] **Step 1: Write failing test for skip decisions**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/skip.test.ts`)
- [ ] **Step 3: Implement skip store and CLI handler**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/skip.test.ts`)

---

### Task 10: Re-run Verification Gates (`CORE-010`)

**Files:**
- Create: `src/verification/verify-run.ts`
- Modify: `src/cli/handlers/verify.ts`
- Test: `tests/cli/verify.test.ts`

**Interfaces:**
- Produces: `verifyConfiguredGates(state: DokionState, playbook: DokionPlaybook): Promise<VerifyResult>`

- [ ] **Step 1: Write failing test for verification gates re-run**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/verify.test.ts`)
- [ ] **Step 3: Implement verify run engine and update handler**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/verify.test.ts`)

---

### Task 11: Stale Run Classifier (`CORE-011`)

**Files:**
- Create: `src/autopilot/stale-run.ts`
- Test: `tests/autopilot/stale-run.test.ts`

**Interfaces:**
- Produces: `classifyStaleRun(state: DokionState, currentContext: SystemContext): StaleRunClassification`

- [ ] **Step 1: Write failing test for stale run classification**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/autopilot/stale-run.test.ts`)
- [ ] **Step 3: Implement stale run classifier**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/autopilot/stale-run.test.ts`)

---

### Task 12: Bounded Autopilot End-to-End Acceptance (`CORE-012`)

**Files:**
- Create: `tests/fixtures/autopilot-project/dokion.json`
- Create: `tests/fixtures/autopilot-project/.dokion/playbook.json`
- Test: `tests/autopilot/bounded-autopilot.e2e.test.ts`

**Interfaces:**
- Produces: End-to-end integration test suite verifying full autopilot lifecycle.

- [ ] **Step 1: Create fixture project files**
- [ ] **Step 2: Write E2E test covering full autopilot lifecycle**
- [ ] **Step 3: Run test to verify E2E passing** (`bun test tests/autopilot/bounded-autopilot.e2e.test.ts`)

---

### Task 13: Built-in Playbook Registry & Shipped Catalog (`PLAY-001`, `PLAY-002`)

**Files:**
- Create: `src/playbook/registry.ts`
- Test: `tests/playbook/registry.test.ts`

**Interfaces:**
- Produces: `getBuiltInPlaybookRegistry(): PlaybookRegistry`

- [ ] **Step 1: Write failing test for registry loading**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/playbook/registry.test.ts`)
- [ ] **Step 3: Implement built-in playbook registry**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/playbook/registry.test.ts`)

---

### Task 14: Playbook List & Inspect CLI Commands (`PLAY-003`)

**Files:**
- Create: `src/cli/handlers/playbook.ts`
- Test: `tests/cli/playbook.test.ts`

**Interfaces:**
- Produces: `listPlaybooks()`, `inspectPlaybook(id: string)`

- [ ] **Step 1: Write failing test for playbook CLI commands**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/playbook.test.ts`)
- [ ] **Step 3: Implement playbook CLI handlers**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/playbook.test.ts`)

---

### Task 15: Playbook Proposal & Activation Handler (`PLAY-004`, `PLAY-005`)

**Files:**
- Modify: `src/playbook/registry.ts`
- Modify: `src/cli/handlers/playbook.ts`
- Test: `tests/playbook/activation.test.ts`

**Interfaces:**
- Produces: `proposePlaybook(id: string)`, `activatePlaybook(proposalPath: string)`

- [ ] **Step 1: Write failing test for playbook activation**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/playbook/activation.test.ts`)
- [ ] **Step 3: Implement propose and activate logic**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/playbook/activation.test.ts`)

---

### Task 16: Capability Lock Engine & Resolution (`CAP-001`, `CAP-002`)

**Files:**
- Create: `src/capability/lock.ts`
- Create: `src/capability/resolver.ts`
- Test: `tests/capability/lock.test.ts`

**Interfaces:**
- Produces: `resolveCapabilityLock(config: CapabilityConfig): CapabilityLock`

- [ ] **Step 1: Write failing test for capability lock**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/capability/lock.test.ts`)
- [ ] **Step 3: Implement capability lock manager and resolver**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/capability/lock.test.ts`)

---

### Task 17: Capability Digest & Git SHA Verifier (`CAP-003`, `CAP-004`)

**Files:**
- Create: `src/capability/verifier.ts`
- Test: `tests/capability/verifier.test.ts`

**Interfaces:**
- Produces: `verifyCapabilityDigests(lock: CapabilityLock): CapabilityVerificationResult`

- [ ] **Step 1: Write failing test for capability verifier**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/capability/verifier.test.ts`)
- [ ] **Step 3: Implement capability digest verification**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/capability/verifier.test.ts`)

---

### Task 18: Capability Audit in Doctor (`CAP-008`)

**Files:**
- Modify: `src/inspect/doctor.ts`
- Modify: `src/cli/handlers/doctor.ts`
- Test: `tests/cli/doctor.test.ts`

**Interfaces:**
- Produces: `runCapabilityAudit(): CapabilityAuditReport`

- [ ] **Step 1: Write failing test for capability audit**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/doctor.test.ts`)
- [ ] **Step 3: Implement capability audit in doctor**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/doctor.test.ts`)

---

### Task 19: Isolated Argument-Vector Command Runner (`EXEC-001`, `EXEC-002`)

**Files:**
- Create: `src/execution/command-runner.ts`
- Test: `tests/execution/command-runner.test.ts`

**Interfaces:**
- Produces: `executeIsolatedCommand(command: CommandSpec): Promise<CommandExecutionResult>`

- [ ] **Step 1: Write failing test for isolated process execution**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/execution/command-runner.test.ts`)
- [ ] **Step 3: Implement isolated process runner using Bun.spawn**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/execution/command-runner.test.ts`)

---

### Task 20: Process Tree Termination & Spooling (`EXEC-004`, `EXEC-005`)

**Files:**
- Modify: `src/execution/command-runner.ts`
- Create: `src/execution/spooler.ts`
- Test: `tests/execution/spooler.test.ts`

**Interfaces:**
- Produces: `spoolCommandOutput(stream: ReadableStream, bound: number): SpoolResult`

- [ ] **Step 1: Write failing test for process termination & output spooling**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/execution/spooler.test.ts`)
- [ ] **Step 3: Implement process kill tree and bounded output spooling**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/execution/spooler.test.ts`)

---

### Task 21: Scope Guard & Pre-Repair Snapshot (`EXEC-006`, `EXEC-007`)

**Files:**
- Create: `src/validation/scope-guard.ts`
- Modify: `src/validation/repair-validator.ts`
- Test: `tests/validation/scope-guard.test.ts`

**Interfaces:**
- Produces: `validateFileScope(modifiedFiles: string[], allowedScopes: string[]): ScopeValidationResult`

- [ ] **Step 1: Write failing test for scope guards**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/validation/scope-guard.test.ts`)
- [ ] **Step 3: Implement scope guard validation**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/validation/scope-guard.test.ts`)

---

### Task 22: Qualification Evaluator & Readiness Report (`EVID-001`, `EVID-002`)

**Files:**
- Create: `src/evidence/readiness.ts`
- Test: `tests/evidence/readiness.test.ts`

**Interfaces:**
- Produces: `evaluateReadinessCriteria(state: DokionState, playbook: DokionPlaybook): ReadinessEvaluation`

- [ ] **Step 1: Write failing test for readiness evaluation**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/evidence/readiness.test.ts`)
- [ ] **Step 3: Implement readiness criteria evaluator**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/evidence/readiness.test.ts`)

---

### Task 23: SARIF v2.1 Exporter (`EVID-006`)

**Files:**
- Create: `src/report/sarif.ts`
- Test: `tests/report/sarif.test.ts`

**Interfaces:**
- Produces: `exportSarifReport(findings: Finding[]): SarifLog`

- [ ] **Step 1: Write failing test for SARIF export**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/report/sarif.test.ts`)
- [ ] **Step 3: Implement SARIF export generator**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/report/sarif.test.ts`)

---

### Task 24: JUnit Test Verification Exporter (`EVID-007`)

**Files:**
- Create: `src/report/junit.ts`
- Test: `tests/report/junit.test.ts`

**Interfaces:**
- Produces: `exportJUnitReport(evidence: Evidence[]): string`

- [ ] **Step 1: Write failing test for JUnit export**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/report/junit.test.ts`)
- [ ] **Step 3: Implement JUnit XML export generator**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/report/junit.test.ts`)

---

### Task 25: Evidence Manifests & Independent Audit Command (`EVID-008`, `EVID-010`)

**Files:**
- Create: `src/evidence/manifest.ts`
- Create: `src/cli/handlers/audit.ts`
- Test: `tests/cli/audit.test.ts`

**Interfaces:**
- Produces: `runIndependentAudit(evidencePath: string): AuditResult`

- [ ] **Step 1: Write failing test for evidence audit**
- [ ] **Step 2: Run test to verify it fails** (`bun test tests/cli/audit.test.ts`)
- [ ] **Step 3: Implement evidence manifest builder and audit command**
- [ ] **Step 4: Run test to verify it passes** (`bun test tests/cli/audit.test.ts`)
