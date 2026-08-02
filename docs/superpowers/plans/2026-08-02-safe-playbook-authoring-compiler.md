# Safe Playbook Authoring Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Let users author Playbooks from Markdown, transcripts, or supported memory sources without directly mutating execution authority or converting untrusted text into executable shell commands

**Architecture:** Split authoring into four explicit stages: source parsing, workflow intent model, project binding, and proposal compilation. The compiler emits an inert proposal, diagnostics, authority summary, unresolved bindings, and digest. A separate activation command remains the only path to `.dokion/playbook.json`

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, existing Creator drivers, Playbook schema validator, built-in capability catalog, proposal activation, Bun test

## Global Constraints

- Creator code must never write `.dokion/playbook.json`
- Text extracted from memory, transcript, Markdown, issues, or pull requests is untrusted data
- A source sentence must not become a shell command without an explicit supported command binding
- Capability selection remains user-only
- Generated proposals must require immutable capability identity where the runtime requires it
- Unknown write scopes, network requirements, installers, and verification commands remain unresolved and block activation
- No default verification command may substitute for the user's intended success criteria
- Human and JSON diagnostics must expose every unresolved binding

---

### Task 1: Introduce a workflow intent intermediate representation

**Files:**
- Create: `src/creator/intent-types.ts`
- Create: `src/creator/intent-schema.ts`
- Modify: `src/creator/interpreter.ts`
- Modify: `src/creator/types.ts`
- Create: `tests/creator/workflow-intent.test.ts`

**Interfaces:**
- Produces: `WorkflowIntentV1`
- Produces: `parseWorkflowIntent(memories: MemoryEntry[], topic?: string): WorkflowIntentV1`

- [ ] **Step 1: Write failing intent tests**

Require the interpreter to distinguish

```ts
interface WorkflowIntentStep {
  id: string
  title: string
  objective: string
  depends_on: string[]
  requested_capability?: string
  requested_command_text?: string
  requested_read_scope: string[]
  requested_write_scope: string[]
  requested_network: "REQUIRED" | "FORBIDDEN" | "UNKNOWN"
  requested_verification: string[]
  ambiguity: string[]
  source_evidence: SourceEvidence[]
}
```

Test that prose such as `install the scanner and fix everything` remains ambiguous intent rather than executable commands

Test that quoted shell text remains source evidence until a binding step approves it

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/creator/workflow-intent.test.ts`

Expected result: the current interpreter returns extracted action steps without the required authority distinctions

- [ ] **Step 3: Implement the intent model**

Preserve source location, source type, excerpt digest, and confidence without storing sensitive raw excerpts in persistent diagnostics

Generate stable step IDs from normalized objective and dependency position rather than arbitrary source order alone

- [ ] **Step 4: Validate graph and ambiguity**

Reject duplicate IDs, dependency cycles, empty objectives, unsupported fields, and source evidence without a digest

Do not reject ambiguous authority requests at the intent stage, record them for binding

- [ ] **Step 5: Run focused tests**

Run `bun test tests/creator/workflow-intent.test.ts`

Expected result: source parsing is deterministic and non-executable

- [ ] **Step 6: Commit**

```bash
git add src/creator/intent-types.ts src/creator/intent-schema.ts src/creator/interpreter.ts src/creator/types.ts tests/creator/workflow-intent.test.ts
git commit -m "refactor: parse authoring sources into workflow intent"
```

### Task 2: Add explicit capability and command binding

**Files:**
- Create: `src/creator/binding/types.ts`
- Create: `src/creator/binding/bind-intent.ts`
- Create: `src/creator/binding/catalog-resolver.ts`
- Create: `src/creator/binding/project-command-resolver.ts`
- Create: `tests/creator/intent-binding.test.ts`

**Interfaces:**
- Produces: `bindWorkflowIntent(root: string, intent: WorkflowIntentV1): Promise<WorkflowBindingResult>`
- Produces: bound steps and unresolved binding diagnostics

- [ ] **Step 1: Write failing binding tests**

Cover

- Exact capability ID present in the inert catalog
- Unknown capability request
- Exact package script binding
- Raw shell text from a transcript
- Installer request
- Missing verification
- Unknown network requirement
- Write scope broader than the project profile allows
- Capability source without immutable identity

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/creator/intent-binding.test.ts`

Expected result: no explicit binding layer exists

- [ ] **Step 3: Implement catalog binding**

A requested capability binds only when the exact ID exists, compatibility matches, source is declared, and required immutable identity is present

No fuzzy substitution is permitted

- [ ] **Step 4: Implement project command binding**

Allow only these initial sources

- A script declared in the project package manifest and invoked through a package-manager argument vector
- A command template already registered by the selected capability
- A user-supplied structured command object provided directly to the authoring command

Raw transcript or Markdown shell strings remain unresolved

- [ ] **Step 5: Produce blocking diagnostics**

Use stable codes

```text
AUTHORING_CAPABILITY_UNRESOLVED
AUTHORING_COMMAND_UNRESOLVED
AUTHORING_VERIFICATION_MISSING
AUTHORING_WRITE_SCOPE_UNRESOLVED
AUTHORING_NETWORK_UNRESOLVED
AUTHORING_INSTALL_REQUEST_UNSUPPORTED
AUTHORING_IMMUTABLE_REFERENCE_MISSING
```

- [ ] **Step 6: Run focused tests**

Run `bun test tests/creator/intent-binding.test.ts`

Expected result: only exact supported bindings become compilable

- [ ] **Step 7: Commit**

```bash
git add src/creator/binding tests/creator/intent-binding.test.ts
git commit -m "feat: bind authoring intent to explicit capabilities"
```

### Task 3: Replace direct compilation with proposal compilation

**Files:**
- Modify: `src/creator/compiler.ts`
- Modify: `src/creator/engine.ts`
- Modify: `src/creator/types.ts`
- Create: `src/creator/proposal-writer.ts`
- Create: `src/creator/authority-report.ts`
- Create: `tests/creator/proposal-compiler.test.ts`

**Interfaces:**
- Produces: `compileProposal(binding: WorkflowBindingResult, options: ProposalCompileOptions): Promise<PlaybookProposalResult>`
- Writes: `.dokion/proposals/<slug>.playbook.json`
- Writes: `.dokion/proposals/<slug>.diagnostics.json`
- Writes: `.dokion/proposals/<slug>.authority.json`

- [ ] **Step 1: Write failing regression tests for current unsafe behavior**

Assert that

- Creator never writes `.dokion/playbook.json`
- Creator never defaults to `run_command`
- Creator never uses `git status --short` as a substitute verification
- Creator never sets `require_verified` or `require_digest` to false when the selected capability contract requires them
- Creator never grants `read: ["**/*"]` or a write scope not requested and bound
- Creator never places raw source commands into `permissions.shell`

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/creator/proposal-compiler.test.ts`

Expected result: the current compiler and engine violate the new proposal boundary

- [ ] **Step 3: Implement minimal proposal compilation**

Compile only fully bound steps

Place unresolved steps in diagnostics and mark the proposal non-activatable

Use exact capability identity, argument-vector command specs, declared scopes, approval rules, failure policy, and verification contracts

- [ ] **Step 4: Implement proposal metadata and digest**

Record source digest, intent digest, binding digest, compiled proposal digest, compiler version, project profile digest, unresolved count, and activation eligibility

- [ ] **Step 5: Implement authority report**

List selected capabilities, command sources, read scope, write scope, network, approvals, installers, verification, stop behavior, and unresolved items by step

- [ ] **Step 6: Run focused and schema tests**

Run

```bash
bun test tests/creator/proposal-compiler.test.ts
bun run validate:contracts
bun run typecheck
```

Expected result: proposals are inert, deterministic, and accurately blocked when incomplete

- [ ] **Step 7: Commit**

```bash
git add src/creator/compiler.ts src/creator/engine.ts src/creator/types.ts src/creator/proposal-writer.ts src/creator/authority-report.ts tests/creator/proposal-compiler.test.ts
git commit -m "fix: compile authoring output as inert proposals"
```

### Task 4: Add a Markdown authoring format

**Files:**
- Create: `src/creator/markdown/parse-authoring-markdown.ts`
- Create: `src/creator/markdown/types.ts`
- Create: `playbooks/templates/authoring-example.md`
- Create: `tests/creator/markdown-authoring.test.ts`

**Interfaces:**
- Consumes: Markdown with exact supported headings and fenced structured blocks
- Produces: `WorkflowIntentV1`

- [ ] **Step 1: Write failing Markdown parser tests**

Support this initial structure

```markdown
# Playbook: Secure Dependency Upgrade

## Step: Inspect dependencies
Objective: Identify outdated direct dependencies
Capability: dependency-inspector
Reads:
- package.json
- bun.lock
Network: required
Verify:
- project test script

## Step: Apply approved upgrade
Depends on:
- inspect-dependencies
Objective: Apply only the approved version changes
Writes:
- package.json
- bun.lock
Approval: before-write
Verify:
- project test script
- project build script
```

Reject duplicate headings, hidden HTML authority fields, unsupported approval values, cycles, absolute paths, traversal, and executable fenced blocks that bypass binding

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/creator/markdown-authoring.test.ts`

Expected result: Markdown parser does not exist

- [ ] **Step 3: Implement strict parsing**

Parse declared fields only

Treat all command-like text as requested bindings rather than executable commands

Record line ranges for diagnostics

- [ ] **Step 4: Add round-trip examples**

The example must parse into a stable intent object and compile only when fixture capabilities and project scripts satisfy every binding

- [ ] **Step 5: Run focused tests**

Run `bun test tests/creator/markdown-authoring.test.ts`

Expected result: deterministic intent output and exact diagnostics

- [ ] **Step 6: Commit**

```bash
git add src/creator/markdown playbooks/templates/authoring-example.md tests/creator/markdown-authoring.test.ts
git commit -m "feat: add strict Markdown Playbook authoring"
```

### Task 5: Redesign the `dokion create` CLI

**Files:**
- Modify: `src/cli/handlers/creator.ts`
- Modify: `src/cli/types.ts`
- Modify: `src/cli/parser.ts`
- Modify: `src/cli/command-registry.ts`
- Modify: `src/cli.ts`
- Create: `tests/cli/create-proposal.test.ts`

**Interfaces:**
- Adds: `dokion create --from-markdown <path> --output <proposal-path>`
- Preserves supported memory and transcript sources as proposal inputs
- Adds JSON output for diagnostics and authority report

- [ ] **Step 1: Write failing CLI tests**

Assert

- Default output is under `.dokion/proposals/`
- Output path cannot equal `.dokion/playbook.json`
- Existing proposal refuses overwrite without exact prior digest
- Raw source cannot silently become shell
- Non-activatable proposal exits non-zero while preserving diagnostics
- Activatable proposal prints the exact separate activation command
- Output contains no decorative success message when unresolved items exist

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/cli/create-proposal.test.ts`

Expected result: current Creator writes the active Playbook and does not expose structured diagnostics

- [ ] **Step 3: Implement proposal-only CLI behavior**

Use the new intent, binding, compiler, and proposal writer interfaces

Return proposal path, digest, activation eligibility, unresolved diagnostics, and authority report path

- [ ] **Step 4: Add exact activation handoff**

For an eligible proposal print

```bash
dokion playbooks activate <proposal-path> --accept-digest sha256:<digest> --by <identity>
```

Do not call activation from `create`

- [ ] **Step 5: Run focused and product-flow tests**

Run

```bash
bun test tests/cli/create-proposal.test.ts tests/cli/product-flow.test.ts
bun run typecheck
bun run build
```

Expected result: authoring and activation remain separate

- [ ] **Step 6: Commit**

```bash
git add src/cli/handlers/creator.ts src/cli/types.ts src/cli/parser.ts src/cli/command-registry.ts src/cli.ts tests/cli/create-proposal.test.ts
git commit -m "feat: make create proposal-only"
```

### Task 6: Add activation compatibility and authority diff checks

**Files:**
- Modify: `src/playbooks/activate-playbook.ts`
- Create: `src/playbooks/compare-authority.ts`
- Create: `tests/playbooks/authoring-activation.test.ts`
- Modify: `src/cli/handlers/playbooks.ts`

**Interfaces:**
- Produces: `comparePlaybookAuthority(previous, proposed): AuthorityDiff`
- Consumes: proposal metadata and exact accepted digest

- [ ] **Step 1: Write failing activation tests**

Cover

- Eligible proposal activates with exact digest and actor
- Unresolved proposal cannot activate
- Changed proposal digest cannot activate
- Authority expansion is displayed before activation
- Existing active Playbook is archived atomically
- Active run blocks activation
- Capability source or digest drift blocks activation

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/playbooks/authoring-activation.test.ts`

Expected result: current activation does not consume the new proposal metadata and authority diff

- [ ] **Step 3: Implement authority diff**

Report added and removed capabilities, read scope, write scope, network, commands, approvals, retry budgets, verification gates, and release gates

- [ ] **Step 4: Enforce proposal eligibility**

Validate proposal metadata, proposal digest, current project profile, capability availability, and exact authority acceptance before writing the active Playbook

- [ ] **Step 5: Run focused and full Playbook tests**

Run

```bash
bun test tests/playbooks/authoring-activation.test.ts tests/playbooks/activation.test.ts tests/playbooks/all-builtins.test.ts
bun run validate:contracts
```

Expected result: no unresolved or changed proposal activates

- [ ] **Step 6: Commit**

```bash
git add src/playbooks/activate-playbook.ts src/playbooks/compare-authority.ts src/cli/handlers/playbooks.ts tests/playbooks/authoring-activation.test.ts
git commit -m "feat: gate authored proposal activation"
```

### Task 7: Publish generated authoring examples and migration guidance

**Files:**
- Create: `docs/playbooks/authoring-compiler.md`
- Modify: `docs/playbooks/custom-authoring.md`
- Create: `docs/migrations/creator-proposal-only.md`
- Create: `tests/docs/custom-playbook-smoke.test.ts`
- Modify: `generated/product-surface.json`

**Interfaces:**
- Consumes: exact CLI snapshots and authoring fixture output
- Produces: one complete Markdown to proposal to activation walkthrough

- [ ] **Step 1: Add failing docs smoke tests**

Require every command to parse, every generated path to match implementation, and every example proposal to validate

- [ ] **Step 2: Document the new boundary**

State clearly that `dokion create` never activates or executes

Explain unresolved binding codes and how users provide exact structured bindings

- [ ] **Step 3: Add migration guidance**

Explain that older Creator behavior wrote directly to the active Playbook and that users must inspect existing generated files before adopting the new compiler

Do not automatically migrate or trust previously generated command digests

- [ ] **Step 4: Regenerate product surface and examples**

Mark the authoring compiler implemented only after proposal-only and activation tests pass

- [ ] **Step 5: Run docs and truth gates**

Run

```bash
bun test tests/docs/custom-playbook-smoke.test.ts
bun run generate:product-surface
bun run validate:public-claims
bun run validate:release-truth
```

Expected result: docs cannot imply direct generation and execution

- [ ] **Step 6: Commit**

```bash
git add docs/playbooks/authoring-compiler.md docs/playbooks/custom-authoring.md docs/migrations/creator-proposal-only.md tests/docs/custom-playbook-smoke.test.ts generated/product-surface.json
git commit -m "docs: explain safe Playbook authoring"
```

## PR Completion Gate

The PR is complete only when no authoring source can directly create execution authority, raw text never becomes executable shell without exact binding, unresolved authority blocks activation, migration risks are documented, CodeRabbit reports no unresolved critical or major issue, and the full repository gate passes on the final branch head
