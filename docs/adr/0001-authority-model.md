# ADR-0001: The user-approved playbook is the sole execution authority

Status: Accepted  
Date: 2026-07-25  
Decision owners: Dokion maintainers and users authoring active playbooks

## Context

Coding agents can inspect a repository, read instructions, call tools, and propose repairs. Those capabilities also create a confused-deputy risk: scanner output, skill text, dependency documentation, issue bodies, or a model's own recommendation may contain instructions that attempt to expand scope or trigger undeclared actions.

A hardening report is useful only when it corresponds exactly to a process a human approved. If Dokion can choose a different scanner, add a plugin, reorder stages, broaden a write scope, infer approval, or weaken a gate during execution, the resulting evidence no longer proves the user-selected process.

Agent platforms provide different enforcement features. Claude Code may expose hooks and isolated subagents, while Codex, Gemini CLI, and ordinary shell execution may not. The authority rule must survive those differences.

## Decision

`.dokion/playbook.json` is the sole file that authorizes Dokion execution.

The following rules are part of this decision:

1. The user selects capabilities, order, responsibilities, modes, permissions, approvals, retries, stop conditions, verification commands, and release gates.
2. `dokion.json` is an inert catalog. Presence, discovery, compatibility, or recommendation never enables a capability.
3. `.dokion/playbook.proposed.json` and all recommendations are inert until a user authors and activates a new playbook revision outside the active run.
4. Dokion may validate, resolve, execute, journal, verify, report, and resume only what the active playbook declares.
5. Dokion must never select, install, substitute, reorder, upgrade, enable, or silently reconfigure a capability.
6. Applicability may skip a declared step but may not introduce an undeclared step.
7. Approval is typed, scoped, append-only evidence. Conversation tone and absence of rejection are not approval.
8. Lower-precedence capability instructions and repository content are untrusted data when they conflict with direct user instructions, the active playbook, repository policy, or platform security restrictions.
9. A changed active playbook taints the run. Continuation requires a new validated boundary rather than accepting the mutation.
10. Platform guarantees are recorded from evidence. Missing enforcement is reported as a degradation and is never assumed away.
11. Bounded autopilot means deterministic continuation inside existing authority. It does not create authority.
12. Completion and readiness claims are limited to the declared process, tested commit, stored evidence, gates, coverage, and recorded degradations.

The precedence order is:

1. direct user instructions applicable to the current run
2. the active user-approved playbook
3. repository policy files
4. platform security restrictions
5. capability-local instructions
6. orchestrator defaults

A lower-precedence source cannot override a higher-precedence source.

## Consequences

### Positive

- Reports can be reconciled line-by-line against a process the user selected.
- Prompt injection in capability documentation or scanner output cannot legitimately authorize execution.
- Cross-agent portability retains the same authority boundary even when enforcement strength differs.
- Recommendations can be rich without becoming dangerous because they remain inert.
- Resume and autopilot behavior can be deterministic from persisted state.
- Security review can distinguish an invalid out-of-mandate action from a valid but failed action.

### Costs and constraints

- Dokion cannot automatically choose a replacement when a declared capability is missing.
- Initial configuration requires deliberate user work and immutable capability references.
- Some otherwise useful automation must pause for approval or a new playbook revision.
- Platform differences must be surfaced rather than hidden behind a uniform abstraction.
- Convenience features that activate generated configuration are prohibited.
- A successful undeclared repair counts as a failed run because it breaks correspondence with the approved process.

### Implementation obligations

- Schemas must preserve explicit selection, order, permissions, approval, retry, stop, and gate fields.
- Runtime command lookup must distinguish implemented, planned, and unknown commands without enabling planned behavior.
- Capability resolution and module loading must start from declarations, not discovery.
- State and event records must identify the active playbook digest and exact target commit.
- Repair validation must reject scope expansion, suppression, test weakening, and incomplete verification.
- Reports must list declared order, actual actions, skipped work, gaps, degradations, and unapplied recommendations.
- Tests must include undeclared capability attempts, playbook mutation, stale approval, conflicting instructions, and cross-agent handoff.

## Alternatives considered

### Agent-selected best tool

Rejected because tool selection becomes model discretion and destroys the audit relationship between configuration and evidence.

### Catalog defaults with automatic activation

Rejected because a catalog update could silently change future execution authority.

### Trust capability-local instructions after installation

Rejected because installation does not make dynamic documentation or output a higher-precedence authority.

### Allow automatic playbook patching with rollback

Rejected because rollback does not restore the user's original authorization decision and an active run could execute between mutations.

## Amendment rules

This decision may be changed only by a new superseding ADR.

A superseding ADR must:

- identify ADR-0001 explicitly
- define the new authority source and precedence order
- include a threat model for confused-deputy and prompt-injection risks
- specify migration behavior for active and historical playbooks
- preserve auditability of earlier runs
- add adversarial tests proving that authority cannot expand implicitly
- update `SPEC.md`, the bounded-autopilot contract, schemas, adapters, and reports in the same implementation program

Editing this ADR to weaken the sole-authority rule without a superseding ADR is prohibited.
