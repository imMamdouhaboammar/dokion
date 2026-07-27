# Dokion Promotion-Ready Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the current Dokion runtime into an evidence-backed bounded hardening product that can be promoted honestly as a public beta and later qualify for the stricter production-grade claim.

**Architecture:** The active playbook remains the only execution authority. The delivery program separates deterministic runtime decisions, built-in and custom playbook management, capability provenance, typed assurance modules, crash-safe state, contained execution, evidence and audit, adapters, and release operations into independently testable workstreams.

**Tech Stack:** Bun 1.3.14 or newer, TypeScript, Bun test, JSON Schema, compiled Bun binaries, GitHub Actions, Claude Code, Codex, Gemini CLI, and ordinary shell adapters.

## Global Constraints

- Bun is mandatory for package operations, scripts, tests, builds, and release workflows.
- Built-in playbooks and custom playbooks are both first-class product paths.
- Built-in, proposed, copied, generated, and recommended playbooks remain inert until explicit activation.
- `.dokion/playbook.json` remains the sole execution authority.
- Dokion never selects, installs, substitutes, reorders, upgrades, or enables a capability automatically.
- Every behavior change starts with a failing test and ends with targeted and related verification.
- Every accepted state transition, approval, skip, retry, side effect, repair, and report must be auditable from disk.
- Secrets, credentials, raw environment values, private absolute paths, and generated local state never enter source control or release artifacts.
- Each commit contains one independently reviewable behavior and is pushed immediately after verification.
- No public claim may exceed `docs/backlog/promotion-readiness.md` or `docs/architecture/production-readiness.md`.

---

## File Structure

- `tasks.md`: active task tracker and promotion-gate status.
- `docs/backlog/README.md`: backlog index and source-of-truth hierarchy.
- `docs/backlog/promotion-readiness.md`: public-beta promotion gate and allowed claims.
- `docs/backlog/core-autopilot.md`: deterministic execution and policy tasks.
- `docs/backlog/playbook-library.md`: built-in registry, custom authoring, activation, and curated playbooks.
- `docs/backlog/capability-modules.md`: capability lock, provenance, module lifecycle, and assurance packs.
- `docs/backlog/state-execution-security.md`: state integrity, recovery, command containment, and repair transactions.
- `docs/backlog/evidence-audit-readiness.md`: completion, reports, evidence, audit, and promotion sign-off.
- `docs/backlog/product-distribution.md`: adapters, user experience, fixtures, CI, release integrity, and launch.
- `docs/progress/production-backlog-progress.md`: merged implementation evidence.

## Execution Protocol

For every task in `tasks.md`:

- [ ] Read the full task card in its linked workstream document.
- [ ] Verify every declared dependency is merged or explicitly reordered for a documented safety reason.
- [ ] Create or reuse an isolated worktree from current `origin/main`.
- [ ] Write the smallest failing test that proves the missing behavior.
- [ ] Run the targeted test and confirm it fails for the expected reason.
- [ ] Implement only the task deliverable without unrelated refactoring.
- [ ] Run targeted, related, contract, type, build, and distribution gates appropriate to the task.
- [ ] Review authority boundaries, write scopes, environment handling, redaction, evidence, rollback, and public claims.
- [ ] Commit one reviewable behavior using the task ID in the pull-request description.
- [ ] Push immediately after verification and record the final main SHA after merge.

## Standard Verification

Every implementation task runs:

```bash
bun test <targeted-test>
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

Distribution, adapter, package, binary, or release tasks also run:

```bash
bun run validate:distribution
bun run smoke:package
bun run scripts/build-release.ts
bunx @google/gemini-cli@0.51.0 extensions validate .
```

State, recovery, process, or repair tasks must additionally run the relevant interruption, stale-state, hostile-path, rollback, and residue fixtures.

## Wave 1: State and Provenance Foundation

**Purpose:** Establish the integrity boundaries required before autopilot or playbook activation can be trusted.

- [ ] Complete `STATE-001` through `STATE-007` and `STATE-009`.
- [ ] Complete `CAP-001` through `CAP-008`.
- [ ] Complete `PLAY-001` through `PLAY-003`.
- [ ] Prove live-run exclusion, monotonic revisions, typed events, journal integrity, repository identity, lock validation, capability provenance, and read-only inspection.

**Wave gate:** A validated project can be inspected and locked without executing a capability, and tampered state, playbook, lock, journal, repository identity, or capability provenance blocks before side effects.

## Wave 2: Policy and Secure Execution

**Purpose:** Build the single deterministic decision path used by run, resume, step, repair, verify, and autopilot.

- [ ] Complete `CORE-001` through `CORE-005`, `CORE-008`, `CORE-009`, and `CORE-011`.
- [ ] Complete `EXEC-001` through `EXEC-009`.
- [ ] Complete `STATE-008`.
- [ ] Complete `PLAY-004` through `PLAY-006`.

**Wave gate:** The runtime selects one declared next action or stops, approvals cannot be bypassed, retries and budgets are bounded, commands are contained, process trees terminate, repair scope is canonical, and every mutation is recoverable or blocked before execution.

## Wave 3: Autopilot, Modules, and Curated Playbooks

**Purpose:** Deliver the product's primary value path using developer-maintained and user-controlled playbooks.

- [ ] Complete `CORE-006`, `CORE-007`, and `CORE-010`.
- [ ] Complete `MOD-001` through `MOD-008`.
- [ ] Complete `PLAY-007` through `PLAY-010` and `PLAY-012`.
- [ ] Validate web full-stack, API service, and library/package built-in playbooks through the common contract harness.

**Wave gate:** A user can list, inspect, copy, configure, validate, explicitly activate, plan, and run a built-in or custom playbook without hidden capability selection or authority expansion.

## Wave 4: Evidence, Audit, and End-to-End Proof

**Purpose:** Make every run and promotion claim independently checkable.

- [ ] Complete `EVID-001` through `EVID-005`, `EVID-008`, and `EVID-010`.
- [ ] Complete `CORE-012`.
- [ ] Prove evidence manifests, checksums, qualified readiness statements, deterministic reports, tamper detection, fake-fix rejection, interruption recovery, approval pause, resume, and audit reconciliation.

**Wave gate:** The bounded-autopilot fixture completes from a clean checkout and `dokion audit` independently reconciles playbook, lock, repository identity, state, events, findings, transactions, evidence, reports, gates, and completion.

## Wave 5: Product, Adapters, Distribution, and Promotion

**Purpose:** Turn the verified runtime into a supportable public-beta release.

- [ ] Complete `PROD-001` through `PROD-005` and `PROD-007` through `PROD-014`.
- [ ] Complete `EVID-012`.
- [ ] Complete every remaining P0 task applicable to the promoted surface.
- [ ] Generate the release-bound promotion sign-off record.
- [ ] Mark PG-001 through PG-012 complete only from release-candidate evidence.

**Wave gate:** Clean package and binary installs, adapter parity, seeded user journeys, required CI jobs, release artifacts, compatibility claims, documentation, support ownership, rollback instructions, and allowed public wording are synchronized for one exact release candidate.

## Production-Grade Continuation

After public beta, complete all remaining P1 work, including state migrations, fuzz and mutation coverage, richer exports, retention bundles, unsupported coverage declarations, native Windows proof, run comparison, and broader assurance packs.

A public-beta release does not automatically qualify as production grade. The final claim remains governed by `docs/architecture/production-readiness.md`.

## Completion Evidence

The program reaches promotion-ready status only when:

- Every applicable P0 task is merged and traceable from `tasks.md` to code, tests, PR, main SHA, and CI evidence.
- The exact release candidate passes PG-001 through PG-012.
- Built-in web, API, and library journeys pass from clean fixtures.
- A custom playbook journey proves proposal, validation, activation, execution, verification, and audit boundaries.
- No unresolved P0 or P1 defect remains on a promoted surface.
- The promotion sign-off record names all included and excluded surfaces, versions, digests, evidence, reviewers, limitations, and revalidation date.
