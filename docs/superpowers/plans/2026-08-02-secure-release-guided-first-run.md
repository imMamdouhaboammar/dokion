# Secure Release Guided First Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Let a new user reach a valid, explicitly approved Secure Release run through one guided command without hand-editing a large Playbook JSON file

**Architecture:** Ship `secure-release` as a curated built-in Pack backed by the existing built-in Playbook registry. `dokion try secure-release` inspects the repository, binds only supported project commands, writes an inert proposal, displays the exact authority diff and digest, then requires explicit acceptance before atomic activation and execution through `ExecutionEngine`

**Tech Stack:** Bun 1.3.14, TypeScript 7.0.2, existing project inspector, built-in Playbook registry, proposal activation, ExecutionEngine, Bun test

## Global Constraints

- `.dokion/playbook.json` remains the sole execution authority
- `dokion try secure-release` must never execute before exact digest acceptance
- The Pack ships inert and cannot install missing tools
- Initial support is Bun or Node TypeScript repositories with Git and deterministic test or build commands
- Unsupported repositories receive actionable diagnostics without a partial active Playbook
- Every persistent transition uses atomic writes, state revision checks, and the project run lock
- The guided path must call the production engine rather than a parallel runner

---

### Task 1: Define the Pack contract and registry entry

**Files:**
- Create: `src/packs/types.ts`
- Create: `src/packs/builtin-packs.ts`
- Create: `playbooks/builtin/secure-release/manifest.json`
- Create: `playbooks/builtin/secure-release/playbook.template.json`
- Create: `playbooks/builtin/secure-release/README.md`
- Modify: `playbooks/registry.json`
- Modify: `schemas/dokion-playbook-registry.schema.json`
- Create: `tests/packs/builtin-packs.test.ts`

**Interfaces:**
- Produces: `getBuiltinPack(id: string): BuiltinPack | null`
- Produces: Pack ID `secure-release`
- Consumes: built-in Playbook registry entry and immutable template digest

- [ ] **Step 1: Write failing Pack registry tests**

Require the Pack to declare

```ts
interface BuiltinPack {
  id: "secure-release"
  version: string
  playbook_id: string
  supported_profiles: readonly ["bun-typescript", "node-typescript"]
  proposal_builder: "secure-release-v1"
  required_bindings: readonly ["test_or_build"]
  optional_bindings: readonly ["typecheck", "lint", "dependency_audit"]
  documentation_path: string
}
```

Assert that the manifest, Playbook template, registry digest, documentation path, and package boundary all validate

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/packs/builtin-packs.test.ts`

Expected result: failure because the Pack contract and files do not exist

- [ ] **Step 3: Create the minimal Secure Release template**

The first template contains these stages only

1. Repository baseline and worktree policy
2. Dependency and lockfile inspection when applicable
3. Declared project validation commands
4. Findings and blocker reconciliation
5. Qualified release statement

Do not include scanners that are unavailable on the inspected machine

Do not include repair steps in the first guided release unless a capability is already present, pinned, and declared by the Pack

- [ ] **Step 4: Register the Pack deterministically**

Add the Pack to the package-owned registry, sort entries by ID, verify exact digests, and expose no activation authority in registry metadata

- [ ] **Step 5: Run Pack and registry tests**

Run

```bash
bun test tests/packs/builtin-packs.test.ts tests/playbooks/builtin-registry.test.ts tests/playbooks/all-builtins.test.ts
bun run validate:contracts
```

Expected result: the Pack is discoverable and inert

- [ ] **Step 6: Commit**

```bash
git add src/packs playbooks/builtin/secure-release playbooks/registry.json schemas/dokion-playbook-registry.schema.json tests/packs/builtin-packs.test.ts
git commit -m "feat: define Secure Release Pack"
```

### Task 2: Resolve supported project commands without guessing

**Files:**
- Create: `src/packs/secure-release/profile-resolver.ts`
- Create: `src/packs/secure-release/command-bindings.ts`
- Create: `src/packs/secure-release/types.ts`
- Create: `tests/packs/secure-release-profile.test.ts`
- Add fixtures: `tests/fixtures/secure-release/bun-typescript/**`
- Add fixtures: `tests/fixtures/secure-release/node-typescript/**`
- Add fixtures: `tests/fixtures/secure-release/unsupported/**`

**Interfaces:**
- Produces: `resolveSecureReleaseProfile(root: string): Promise<SecureReleaseProfileResult>`
- Produces: exact argument-vector commands rather than shell strings

- [ ] **Step 1: Write failing profile tests**

Cover

- Bun project with `test`, `typecheck`, and `build` scripts
- Node project with a supported lockfile and `npm test`
- Project with no deterministic validation command
- Project with script values containing shell control operators
- Project with multiple package managers
- Dirty worktree under `clean-only`

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/packs/secure-release-profile.test.ts`

Expected result: failure because the resolver does not exist

- [ ] **Step 3: Implement conservative profile resolution**

Resolve only scripts declared in `package.json` and invoke them through package-manager argument vectors

Accepted examples

```ts
["bun", "run", "test"]
["npm", "run", "test", "--"]
["pnpm", "run", "typecheck"]
```

Reject ambiguous package manager state and never split user script contents into a new shell command

- [ ] **Step 4: Return explicit unsupported diagnostics**

Use stable reason codes

```text
SECURE_RELEASE_PROFILE_UNSUPPORTED
SECURE_RELEASE_PACKAGE_MANAGER_AMBIGUOUS
SECURE_RELEASE_VALIDATION_COMMAND_MISSING
SECURE_RELEASE_SCRIPT_UNSAFE
```

- [ ] **Step 5: Run focused tests**

Run `bun test tests/packs/secure-release-profile.test.ts`

Expected result: supported fixtures resolve exact commands and unsupported fixtures produce stable diagnostics

- [ ] **Step 6: Commit**

```bash
git add src/packs/secure-release tests/packs/secure-release-profile.test.ts tests/fixtures/secure-release
git commit -m "feat: resolve Secure Release project bindings"
```

### Task 3: Build an inert project-specific proposal

**Files:**
- Create: `src/packs/secure-release/proposal-builder.ts`
- Create: `src/packs/authority-summary.ts`
- Create: `tests/packs/secure-release-proposal.test.ts`
- Modify: `src/playbooks/copy-proposal.ts`

**Interfaces:**
- Produces: `buildSecureReleaseProposal(root: string, profile: SecureReleaseProfile): Promise<PackProposalResult>`
- Writes: `.dokion/proposals/secure-release.playbook.json`
- Writes: `.dokion/proposals/secure-release.authority.json`

- [ ] **Step 1: Write failing proposal tests**

Assert that proposal generation

- Preserves template capability identity and order
- Binds only resolved project commands
- Includes exact read and write scopes
- Contains no placeholder values
- Does not create or modify `.dokion/playbook.json`
- Produces the same digest for the same repository state
- Refuses overwrite unless the previous proposal digest is supplied

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/packs/secure-release-proposal.test.ts`

Expected result: failure because proposal generation does not exist

- [ ] **Step 3: Implement proposal building**

Use the existing Playbook schema validator after binding

Write proposal metadata containing Pack ID, Pack version, template digest, repository profile digest, proposal digest, generated time, and unresolved optional checks

- [ ] **Step 4: Implement authority summary**

The summary must list

- Files and directories readable
- Files and directories writable
- Network permission by step
- Exact commands
- Approval gates
- Stop and rollback rules
- Missing optional checks
- Final proposal digest

- [ ] **Step 5: Verify deterministic proposal output**

Run

```bash
bun test tests/packs/secure-release-proposal.test.ts
bun run validate:contracts
```

Expected result: the proposal is valid, deterministic, and inert

- [ ] **Step 6: Commit**

```bash
git add src/packs/secure-release/proposal-builder.ts src/packs/authority-summary.ts src/playbooks/copy-proposal.ts tests/packs/secure-release-proposal.test.ts
git commit -m "feat: create inert Secure Release proposals"
```

### Task 4: Add `dokion try secure-release`

**Files:**
- Modify: `src/cli/types.ts`
- Modify: `src/cli/parser.ts`
- Modify: `src/cli/command-registry.ts`
- Modify: `src/cli.ts`
- Create: `src/cli/handlers/try-pack.ts`
- Create: `tests/cli/try-pack.test.ts`

**Interfaces:**
- Adds: `dokion try secure-release`
- Adds: `dokion try secure-release --accept-digest <sha256> --by <identity>`
- Produces: proposal summary when no digest is accepted
- Produces: activation and production run result only after exact digest acceptance

- [ ] **Step 1: Write parser and negative-control tests**

Test

- Unknown Pack ID fails
- Missing actor fails when acceptance is requested
- Digest mismatch fails before activation
- Proposal mutation after preview fails
- Unsupported profile leaves active Playbook unchanged
- Dry invocation writes only inert proposal artifacts
- Accepted invocation routes to `ExecutionEngine.run`

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/cli/try-pack.test.ts`

Expected result: parser and handler are absent

- [ ] **Step 3: Implement preview mode**

`dokion try secure-release` performs inspection, profile resolution, proposal generation, validation, and authority rendering

It returns the exact command required for non-interactive acceptance

```bash
dokion try secure-release --accept-digest sha256:<exact-digest> --by <identity>
```

- [ ] **Step 4: Implement accepted mode**

Acquire the project run lock

Recompute and compare the proposal digest

Record actor and source

Activate through `src/playbooks/activate-playbook.ts`

Execute through `new ExecutionEngine(root).run()`

Do not invoke `handleAutopilotCommand` or another parallel path

- [ ] **Step 5: Add human and JSON output**

Preview output includes proposal path, digest, stages, permissions, commands, unsupported optional checks, and acceptance command

Accepted output includes run ID, active digest, status, blockers, and Run Trace path when Workstream 2 is available

- [ ] **Step 6: Run focused and product-flow tests**

Run

```bash
bun test tests/cli/try-pack.test.ts tests/cli/product-flow.test.ts
bun run typecheck
bun run build
```

Expected result: no execution occurs without exact acceptance and accepted mode uses the production engine

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts src/cli/types.ts src/cli/parser.ts src/cli/command-registry.ts src/cli/handlers/try-pack.ts tests/cli/try-pack.test.ts tests/cli/product-flow.test.ts
git commit -m "feat: add guided Secure Release first run"
```

### Task 5: Prove the complete journey with a seeded repository

**Files:**
- Create: `tests/acceptance/secure-release-journey.test.ts`
- Create: `tests/fixtures/promotion/secure-release-pass/**`
- Create: `tests/fixtures/promotion/secure-release-blocked/**`
- Modify: `scripts/smoke-test-package.ts`

**Interfaces:**
- Consumes: packaged Dokion installation
- Produces: exact first-run transcript and evidence assertions

- [ ] **Step 1: Create a failing packaged acceptance test**

The pass fixture must complete declared checks

The blocked fixture must contain a deterministic failing test and must finish with no readiness claim

The test must invoke the installed CLI rather than importing internal functions

- [ ] **Step 2: Run the focused acceptance test and confirm RED**

Run `bun test tests/acceptance/secure-release-journey.test.ts`

Expected result: the journey is incomplete before all Pack tasks are implemented

- [ ] **Step 3: Assert first-proposal usability**

The test must verify

- Preview output needs no manual JSON edit
- Proposal contains no placeholders
- Exact acceptance command is present
- Digest mismatch is rejected
- Accepted run reaches the production engine
- Blocked fixture cannot report completion

- [ ] **Step 4: Add clean-install smoke coverage**

Extend `scripts/smoke-test-package.ts` to run preview mode against the pass fixture from a packed installation

- [ ] **Step 5: Run complete gates**

Run

```bash
bun test tests/acceptance/secure-release-journey.test.ts
bun test
bun run typecheck
bun run build
bun run validate:distribution
bun run smoke:package
```

Expected result: both pass and blocked journeys behave exactly as declared

- [ ] **Step 6: Commit**

```bash
git add tests/acceptance/secure-release-journey.test.ts tests/fixtures/promotion/secure-release-pass tests/fixtures/promotion/secure-release-blocked scripts/smoke-test-package.ts
git commit -m "test: prove Secure Release first-run journey"
```

### Task 6: Publish Pack documentation only after the acceptance journey passes

**Files:**
- Create: `docs/packs/secure-release.md`
- Modify: `README.md`
- Modify: `docs/getting-started/onboarding.md`
- Modify: `tests/docs/onboarding-smoke.test.ts`
- Modify: `generated/product-surface.json`

**Interfaces:**
- Consumes: generated CLI help and acceptance transcript
- Produces: copy-ready first-run commands with exact supported scope

- [ ] **Step 1: Add failing docs assertions**

Require the Secure Release page to state supported project profiles, explicit activation behavior, unavailable automatic installs, possible blockers, exact commands, and qualified output language

- [ ] **Step 2: Write the Pack documentation**

Lead with the user problem and first result rather than Registry or schema details

Include one real blocked example and one passing example generated from acceptance fixtures

- [ ] **Step 3: Regenerate product surface**

Mark `pack:secure-release` as `IMPLEMENTED` only after the packaged acceptance journey passes

- [ ] **Step 4: Run docs and truth gates**

Run

```bash
bun test tests/docs/onboarding-smoke.test.ts
bun run generate:product-surface
bun run validate:public-claims
bun run validate:release-truth
```

Expected result: documentation contains no unsupported command or outcome

- [ ] **Step 5: Commit**

```bash
git add docs/packs/secure-release.md README.md docs/getting-started/onboarding.md tests/docs/onboarding-smoke.test.ts generated/product-surface.json
git commit -m "docs: publish Secure Release guided journey"
```

## PR Completion Gate

The PR is complete only when the two seeded journeys pass from a packed clean installation, preview mode cannot mutate the active Playbook, digest acceptance is exact, execution uses `ExecutionEngine`, CodeRabbit critical and major issues are resolved, and the branch is current with `main`
