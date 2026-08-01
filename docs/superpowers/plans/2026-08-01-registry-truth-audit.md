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

- [ ] Write tests proving pull, publish, leaderboard, and sync cannot report success without a real transport, verified bytes, or lockfile transition.
- [ ] Run `bun test tests/registry/registry-truth.test.ts` and record the expected failures against the current simulation.
- [ ] Commit the failing contract tests.

### Task 2: Quarantine the simulated Community Hub

**Files:**
- Modify: `src/registry/hub.ts`
- Modify: `src/cli/handlers/hub.ts`
- Test: `tests/registry/registry-truth.test.ts`

**Interfaces:**
- Produces: `RegistryUnavailableError` behavior through stable Dokion error codes

- [ ] Remove the hardcoded catalog and synthetic Playbook generation path.
- [ ] Make search return an empty truthful snapshot until a configured Registry source exists.
- [ ] Make pull, publish, rate, fork, merge, and leaderboard fail with `REGISTRY_NOT_IMPLEMENTED` or `REGISTRY_SOURCE_REQUIRED`.
- [ ] Run focused tests and commit.

### Task 3: Make Playbook sync fail closed

**Files:**
- Modify: `src/cli/handlers/playbooks.ts`
- Test: `tests/registry/registry-truth.test.ts`

**Interfaces:**
- Produces: non-zero CLI status for the unimplemented sync lifecycle

- [ ] Replace the unconditional sync success response with an explicit error result and exit code 1.
- [ ] Preserve import, validate, and list behavior.
- [ ] Run focused tests and commit.

### Task 4: Replace the misleading GitHub Pages storefront

**Files:**
- Modify: `docs/index.html`
- Modify: `docs/styles.css`
- Delete: `docs/app.js`
- Delete: `docs/catalog.json`
- Test: `tests/docs/public-site-truth.test.ts`

**Interfaces:**
- Produces: static documentation landing page with no unsupported marketplace data or executable-looking controls

- [ ] Add a source-level test forbidding marketplace metrics, verified badges, fake commands, inline handlers, and unsafe dynamic rendering.
- [ ] Replace the current page with a restrained landing page linking to Getting Started, SPEC, security, and issue #47.
- [ ] Remove the catalog and application script.
- [ ] Run focused tests and commit.

### Task 5: Record the Registry architecture decisions

**Files:**
- Create: `docs/adr/0003-federated-playbook-registry.md`
- Create: `docs/adr/0004-registry-trust-and-authority.md`
- Create: `docs/adr/0005-public-site-is-not-authority.md`
- Modify: `docs/adr/README.md`

**Interfaces:**
- Produces: accepted decisions for federation, trust-state separation, and static Store boundaries

- [ ] Document selected and rejected alternatives.
- [ ] Define source transports for v1 and the separation between integrity, identity, install, and activation.
- [ ] Update the ADR index and commit each coherent decision set.

### Task 6: Supersede the obsolete Hub design

**Files:**
- Modify: `docs/superpowers/specs/2026-08-01-community-playbook-hub-design.md`
- Create: `docs/architecture/registry-truth-audit.md`

**Interfaces:**
- Produces: a migration record mapping current false claims to the future subsystem that will replace them

- [ ] Mark the old design as superseded and explain why telemetry-backed rankings and synthetic publishing are rejected.
- [ ] Add an inventory of removed behavior, preserved runtime behavior, and later PR ownership.
- [ ] Commit.

### Task 7: Run repository verification

**Files:**
- Modify only files required by discovered failures.

- [ ] Run `bun test`.
- [ ] Run `bun run typecheck`.
- [ ] Run `bun run validate:contracts`.
- [ ] Run `bun run build`.
- [ ] Run `bun run validate:distribution`.
- [ ] Run `bun run smoke:package`.
- [ ] Record exact results in the PR body. Do not claim local verification when the local execution device is unavailable.

### Task 8: Review and PR completion

**Files:**
- No planned production files.

- [ ] Run a scoped Codex Security review over Registry, CLI, public docs, and workflow changes.
- [ ] Run CodeRabbit against the branch diff when authentication is available.
- [ ] Resolve critical and major issues.
- [ ] Open a PR linked to #47 with rollback notes, removed claims, CI evidence, and remaining scope.
