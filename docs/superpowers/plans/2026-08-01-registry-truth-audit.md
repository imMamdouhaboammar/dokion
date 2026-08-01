# Registry Truth Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Stop Dokion from presenting simulated registry, pull, publish, sync, telemetry, and marketplace behavior as implemented while preserving a clear migration path to the real federated Registry.

**Architecture:** This first delivery round is a fail-closed quarantine. It removes unsupported public claims, disables simulated network and lifecycle operations, records the selected federated architecture in ADRs, and adds contract tests that prevent the simulation from returning. The real Registry, package format, cache, lockfile, publishing, and Store are delivered in later PRs under issue #47.

**Tech Stack:** Bun 1.3.14, TypeScript, Bun test, JSON Schema, static GitHub Pages, GitHub Actions.

## Global Constraints

- `.dokion/playbook.json` remains the sole execution authority.
- Pull, install, and activation are separate transitions.
- Registry metadata never grants execution authority.
- Unsupported behavior fails closed and must not return success.
- No invented downloads, ratings, installs, success rates, trust scores, or publisher verification.
- No untrusted `innerHTML` or inline event handlers in the public site.
- Every commit must be a meaningful reviewable unit.

---

### Task 1: Add regression tests for simulated Registry behavior

**Files:**
- Create: `tests/registry/registry-truth.test.ts`
- Test: `tests/registry/registry-truth.test.ts`

**Interfaces:**
- Consumes: `DokionCommunityHub`, `handleHubCommand`, `handlePlaybooksCommand`
- Produces: behavioral contract requiring fail-closed responses for unimplemented remote Registry operations

- [x] Write tests proving pull, publish, leaderboard, and sync cannot report success without a real transport, verified bytes, or lockfile transition.
- [x] Run the focused contract through GitHub Actions and record the expected failures against the current simulation.
- [x] Commit the failing contract tests.

### Task 2: Quarantine the simulated Community Hub

**Files:**
- Modify: `src/registry/hub.ts`
- Modify: `src/cli/handlers/hub.ts`
- Test: `tests/registry/registry-truth.test.ts`

**Interfaces:**
- Produces: fail-closed behavior through stable Dokion error codes

- [x] Remove the hardcoded catalog and synthetic Playbook generation path.
- [x] Make search return an empty truthful snapshot until a configured Registry source exists.
- [x] Make pull, publish, rate, fork, merge, and leaderboard fail with `REGISTRY_NOT_IMPLEMENTED` or `REGISTRY_SOURCE_REQUIRED`.
- [x] Run focused tests and commit.

### Task 3: Make Playbook sync fail closed

**Files:**
- Modify: `src/cli/handlers/playbooks.ts`
- Test: `tests/registry/registry-truth.test.ts`

**Interfaces:**
- Produces: non-zero CLI status for the unimplemented sync lifecycle

- [x] Replace the unconditional sync success response with an explicit error result and exit code 1.
- [x] Preserve import, validate, and list behavior.
- [x] Run focused tests and commit.

### Task 4: Replace the misleading GitHub Pages storefront

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/styles.css`
- Delete: `docs/app.js`
- Delete: `docs/catalog.json`
- Test: `tests/docs/public-site-truth.test.ts`

**Interfaces:**
- Produces: static documentation landing page with no unsupported marketplace data or executable-looking controls

- [x] Add a source-level test forbidding marketplace metrics, verified badges, fake commands, inline handlers, and unsafe dynamic rendering.
- [x] Replace the current page with a restrained landing page linking to README, SPEC, security, and issue #47.
- [x] Remove the catalog and application script.
- [x] Run focused tests and commit.

### Task 5: Record the Registry architecture decisions

**Files:**
- Create: `docs/adr/0003-federated-playbook-registry.md`
- Create: `docs/adr/0004-registry-trust-and-authority.md`
- Create: `docs/adr/0005-public-site-is-not-authority.md`
- Modify: `docs/adr/README.md`

**Interfaces:**
- Produces: accepted decisions for federation, trust-state separation, and static Store boundaries

- [x] Document selected and rejected alternatives.
- [x] Define source transports for v1 and the separation between integrity, identity, install, and activation.
- [x] Update the ADR index and commit each coherent decision set.

### Task 6: Supersede the obsolete Hub design

**Files:**
- Modify: `docs/superpowers/specs/2026-08-01-community-playbook-hub-design.md`
- Create: `docs/architecture/registry-truth-audit.md`

**Interfaces:**
- Produces: a migration record mapping current false claims to the future subsystem that will replace them

- [x] Mark the old design as superseded and explain why telemetry-backed rankings and synthetic publishing are rejected.
- [x] Add an inventory of removed behavior, preserved runtime behavior, and later PR ownership.
- [x] Commit.

### Task 7: Run repository verification

**Files:**
- Modify only files required by discovered failures.

- [x] Run `bun test` through CI.
- [x] Run `bun run typecheck` through CI.
- [x] Run `bun run validate:contracts` through CI.
- [x] Run `bun run build` through CI.
- [x] Run release binary smoke tests through CI.
- [x] Run `bun run validate:distribution` through CI.
- [x] Run `bun run smoke:package` through CI.
- [x] Run Gemini extension validation and residue checks through CI.
- [x] Record exact results in PR #48 without claiming unavailable local verification.

### Task 8: Review and PR completion

**Files:**
- No planned production files.

- [ ] Run a scoped Codex Security review over Registry, CLI, public docs, and workflow changes when the Codex Security scan environment is available.
- [ ] Run CodeRabbit against the non-draft branch diff.
- [ ] Resolve critical and major issues.
- [x] Open PR #48 linked to #47 with rollback notes, removed claims, CI evidence, and remaining scope.

## Verification evidence

- RED Registry run 601: 426 passed, 5 failed. The five expected failures proved the hardcoded catalog, synthetic pull, in-memory publish, ranking, and no-op sync behavior.
- Registry GREEN and public-site RED run 613: 430 passed, 3 failed. Registry contracts passed; only the intentionally missing public-site truth boundary failed.
- ADR RED run 623: 431 passed, 5 failed. The public-site truth checks passed; the five expected failures proved ADR-0003 through ADR-0005 were absent.
- Migration-record RED run 633: the new architecture migration contract failed while the obsolete design remained active.
- Full GREEN run 637: all workflow steps passed, including schema conformance, runtime contract validation, 436 tests, typecheck, build, release binaries, packed distribution, clean Bun installation, Gemini extension validation, and residue checks.
