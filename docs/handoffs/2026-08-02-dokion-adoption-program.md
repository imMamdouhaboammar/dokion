# Dokion Adoption Program Handoff

## Session identity

Date

`2026-08-02`

Repository

`imMamdouhaboammar/dokion`

Planning branch

`docs/adoption-program-2026-08-02`

Baseline commit

`4190d8768fc15eaf10d83816bc235bb00a331011`

## Purpose

This handoff preserves the product leadership decisions and implementation planning required to make Dokion easier to adopt without weakening its authority and evidence model

## Current repository observations

- The current public positioning has moved from a software-hardening runtime toward a general Playbook Engine for coding agents
- Some public examples and claims need executable evidence before they are safe launch language
- `dokion verify` currently needs a dedicated production verification path rather than repository contract validation alone
- `dokion playbooks import --from <value>` currently treats the value as a filesystem source path, so named built-in sources must not be documented until implemented
- The Creator engine currently defaults to `.dokion/playbook.json`, which conflicts with the intended proposal and activation separation
- The Creator compiler currently converts extracted actions into a generic command capability with broad permissions and fallback verification that is not sufficient for safe authoring
- Registry package building, verification, bounded pull, and immutable cache publication have real merged implementation evidence
- Registry installation, activation, publishing, and Store completion remain separate infrastructure work

## Accepted product direction

Category

`Agent Execution Control`

Initial wedge

`Software hardening and release assurance`

First supported Pack

`secure-release`

First supported repository family

- Bun TypeScript
- Node TypeScript

Core product promise

`Dokion makes coding agents follow the declared engineering process and prove the result`

## Program files

Design

- `docs/superpowers/specs/2026-08-02-dokion-product-adoption-design.md`

Plan index

- `docs/superpowers/plans/2026-08-02-dokion-adoption-program-index.md`

Implementation plans

- `docs/superpowers/plans/2026-08-02-truth-and-positioning-reset.md`
- `docs/superpowers/plans/2026-08-02-secure-release-guided-first-run.md`
- `docs/superpowers/plans/2026-08-02-run-trace-and-shareable-evidence.md`
- `docs/superpowers/plans/2026-08-02-safe-playbook-authoring-compiler.md`
- `docs/superpowers/plans/2026-08-02-documentation-demo-and-adoption-validation.md`

Roadmap

- `docs/roadmap/adoption-program-2026-q3.md`

## Recommended next action

Start PR A from the plan index

`Product truth surface`

Do not begin Secure Release implementation until the truth and claim contracts are accepted

Within PR A, repair public wording first and add generated claim enforcement

Implement the `dokion verify` runtime correction as the next separate PR because it changes behavior and needs its own review boundary

## Required execution method

Preferred

- Superpowers subagent-driven development
- Fresh subagent per task
- Review after each task
- TDD with focused RED and GREEN evidence

Alternative

- Superpowers executing-plans in one branch with checkpoints after each task

## PR Completion contract

No PR is complete until

- Planned behavior exists
- Negative controls pass
- Focused and full required gates pass
- Documentation matches behavior
- Migration and rollback are documented
- Branch is current with `main`
- CodeRabbit review has completed
- All critical and major CodeRabbit issues are resolved or rejected with evidence
- All review threads are resolved
- Security review runs for security-sensitive scope
- No unsupported public claim remains

## External tool status

### Context7

Used successfully for current Bun and Astro Starlight implementation guidance

Relevant decisions captured in the plans

- Bun standalone executable and test patterns remain compatible with the current CLI architecture
- Starlight custom proof routes should use `StarlightPage`
- Component overrides must preserve Starlight accessibility contracts
- Site deployment must use the `/dokion/` base path

### Create State

Attempted during planning

Result

- HTTP 403 from the Create State service transport

Fallback

- This repository handoff records the full project state until Create State is available again

Do not claim that Create State persistence succeeded

### CodeRabbit

Planning files are ready for GitHub App review after the draft PR is opened

Do not claim review completion until a real review response exists

### Develoop

No callable Develoop action was exposed in the current tool surface

The planning artifacts preserve the expected development loop through small PRs, test-first execution, review gates, and explicit handoffs

### PR Completion

The completion contract is embedded in every implementation plan and in the roadmap

## Unresolved decisions

These do not block PR A

- Exact supported Node package managers for Secure Release v1
- Exact Astro and Starlight versions at implementation time
- Whether static HTML Run Trace export ships in the same PR as JSON and Markdown
- Whether the first cohort is public open source only or includes consented private repositories with sanitized traces
- Which product direction follows Gate F

## Stop conditions

Stop implementation and escalate when

- A plan would widen execution authority implicitly
- A new path bypasses `ExecutionEngine`
- A public claim lacks a canonical evidence source
- A generated Playbook contains unresolved shell, scope, network, or verification authority
- A passing test does not prove the required repository effect
- A repair has no rollback proof

## Resume prompt

Use this exact instruction to continue

```text
Continue the Dokion Adoption Program from docs/handoffs/2026-08-02-dokion-adoption-program.md
Start with PR A from docs/superpowers/plans/2026-08-02-dokion-adoption-program-index.md
Use Superpowers subagent-driven development, TDD, CodeRabbit review, and the embedded PR Completion gates
Do not start later phases before the current exit gate passes
```
