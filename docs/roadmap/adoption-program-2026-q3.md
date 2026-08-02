# Dokion Adoption Program Roadmap

## Baseline

Planning baseline commit

`4190d8768fc15eaf10d83816bc235bb00a331011`

Program branch

`docs/adoption-program-2026-08-02`

This roadmap starts a new product adoption program without reopening old completion claims or treating prior promotion checklists as proof for the new product promise

## Leadership decision

Dokion will not spend the next delivery cycle broadening the feature surface

The immediate priority is to prove one complete supported journey

`Secure Release on Bun or Node TypeScript repositories`

The delivery hierarchy is

1. Truth
2. First useful proposal
3. Explicit accepted execution
4. Shareable evidence
5. Safe authoring
6. Documentation and external use
7. Broader Packs and Registry investment

## Current risk assessment

### Product risk

Users cannot quickly distinguish Dokion from a hardening scanner, a Skill, an agent framework, or a Registry

Response

- Lead with one user problem and one supported Pack
- Hide protocol detail until after first value

### Truth risk

Recent public wording can exceed the behavior currently proven by CLI and acceptance tests

Response

- Add generated product state and claim validation before more launch work

### First-run risk

Reference Playbooks require too much manual configuration for a first encounter

Response

- Create an inert project-specific proposal through `dokion try secure-release`

### Authority risk

The current Creator path can write directly to `.dokion/playbook.json`

Response

- Make all authoring proposal-only and require separate exact-digest activation

### Verification risk

The current `dokion verify` CLI route must prove declared gates rather than rely on repository contract validation

Response

- Repair verification as a dedicated P0 PR before using it in proof assets

### Evidence risk

HARDENING.md is useful but not yet one versioned cross-surface proof object

Response

- Introduce `dokion.run-trace.v1` and derive every public report from it

## Delivery lanes

### Lane 1: Product truth

Owner role

- Staff engineer with documentation contract responsibility

Deliverables

- Product surface snapshot
- Claim validator
- Verification contract repair
- Release truth gate

Priority

- P0

Merge gate

- No unsupported public command or outcome

### Lane 2: Secure Release

Owner role

- Runtime engineer

Deliverables

- Pack contract
- Profile resolver
- Proposal builder
- Guided command
- Acceptance fixtures

Priority

- P0

Merge gate

- Preview cannot execute
- Accepted run uses production engine

### Lane 3: Run Trace

Owner role

- Evidence and state engineer

Deliverables

- Versioned schema
- Verified projection
- CLI and exports
- Lifecycle integration

Priority

- P0

Merge gate

- Every terminal state has an accurate trace

### Lane 4: Authoring compiler

Owner role

- Playbook systems engineer

Deliverables

- Intent model
- Exact binding
- Proposal compiler
- Markdown authoring
- Activation diff

Priority

- P1 until Lane 2 and Lane 3 are stable

Merge gate

- No source text gains execution authority directly

### Lane 5: Documentation and proof

Owner role

- Developer experience engineer

Deliverables

- Starlight site
- Generated references
- Demo repository
- Browser QA
- External cohort

Priority

- P1 until the supported CLI path exists

Merge gate

- Site commands and examples are generated from passing acceptance journeys

### Lane 6: Registry continuation

Owner role

- Registry and supply-chain engineer

Deliverables

- Existing infrastructure backlog only

Priority

- P1 constrained parallel lane

Merge gate

- No delay to truth, Secure Release, or Run Trace

## Release gates

### Gate A: Truthful surface

Pass conditions

- Product surface snapshot generated
- Public claim lint passes
- CLI docs parse
- `dokion verify` runs declared gates

Product status after gate

- Internal alpha with truthful public repository

### Gate B: Useful first proposal

Pass conditions

- Supported repositories produce valid proposals without JSON editing
- Unsupported repositories fail with exact diagnostics
- Proposal digest is deterministic

Product status after gate

- Private guided trial

### Gate C: Accepted production run

Pass conditions

- Exact digest and actor required
- Activation is atomic
- Execution routes through `ExecutionEngine`
- Passing and blocked fixtures pass

Product status after gate

- Limited public beta candidate

### Gate D: Shareable proof

Pass conditions

- Run Trace schema passes conformance
- Terminal and export outputs agree
- Corrupted or missing evidence fails closed
- HTML export is self-contained and escaped

Product status after gate

- Public beta candidate with proof

### Gate E: Safe authoring

Pass conditions

- Creator is proposal-only
- Raw source commands remain unresolved
- Authority diff required before activation

Product status after gate

- Custom Playbook beta

### Gate F: External validation

Pass conditions

- Deployed docs complete the supported journey
- Demo is generated from real execution
- Ten external repository records validated
- Adoption and confusion results published with limitations

Product status after gate

- Decision point for next Pack and Registry investment

## Capacity allocation

Until Gate D

- 70 percent product truth, Secure Release, and Run Trace
- 20 percent defects, reviews, and release integrity
- 10 percent Registry continuation

After Gate D and before Gate F

- 50 percent authoring and docs
- 30 percent external validation and fixes
- 20 percent Registry continuation

No new general-purpose runtime feature receives capacity unless it removes a blocker from the supported journey

## Review policy

Every runtime PR requires

- Failing negative control before implementation where practical
- Focused tests
- Full repository tests
- Typecheck
- Build
- Distribution validation
- Package smoke when public CLI or package files change
- CodeRabbit review request
- Resolution of critical and major review issues
- Exact rollback notes
- Branch synchronized with `main`

Every documentation PR requires

- Generated data drift check
- Public claim validation
- Command parse checks
- Link validation
- Accessibility tests for site changes
- Deployed preview check when applicable

## Decision log

### Accepted

- Hardening as the initial market wedge
- Agent Execution Control as the broader category
- Secure Release as the first Pack
- Bun and Node TypeScript as the first supported repository family
- Proposal before activation
- Exact digest and actor acceptance
- Run Trace as the core proof object
- Starlight for documentation
- Manual consent-based cohort before telemetry

### Rejected for this cycle

- Leading with the Registry
- Leading with agent swarms
- Generic support for every language and repository type
- Creator writing the active Playbook
- Mandatory hosted backend
- Ratings and popularity metrics
- Automatic installation or activation
- Marketing based mainly on stars

## Next product decision after Gate F

Choose exactly one based on cohort evidence

1. Add a second Pack for PR Rescue
2. Expand Secure Release to Python
3. Prioritize team governance and organization policy
4. Increase Registry and Store investment

The decision must cite observed repository demand, repeated run behavior, and unresolved friction rather than category enthusiasm alone
