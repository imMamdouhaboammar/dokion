# Dokion Adoption Program Plan Index

## Program objective

Turn Dokion from a technically capable but difficult-to-understand runtime into a truthful product with one guided first journey, one shareable evidence format, and one safe authoring path

## Execution order

### Phase 0: Truth before growth

Plan

- [`2026-08-02-truth-and-positioning-reset.md`](2026-08-02-truth-and-positioning-reset.md)

Required outcome

- Current product claims match executable behavior
- `dokion verify` runs declared verification gates rather than schema validation alone
- Public docs fail CI when commands, integrations, or outcomes drift from canonical product state

No later public launch work may merge before Phase 0 is green

### Phase 1: One guided product journey

Plan

- [`2026-08-02-secure-release-guided-first-run.md`](2026-08-02-secure-release-guided-first-run.md)

Required outcome

- A supported Bun or Node TypeScript repository can run `dokion try secure-release`
- Preview mode creates an inert proposal and exact authority summary
- Execution requires an exact accepted digest and actor identity
- Accepted execution routes through the production `ExecutionEngine`
- Passing and blocked clean-install fixtures prove the journey

### Phase 2: Evidence that users can inspect and share

Plan

- [`2026-08-02-run-trace-and-shareable-evidence.md`](2026-08-02-run-trace-and-shareable-evidence.md)

Required outcome

- Every terminal run state has a `dokion.run-trace.v1` projection
- Terminal, JSON, Markdown, and static HTML outputs agree
- Readiness language comes from one qualified evidence-backed source
- Missing or corrupted proof fails closed

### Phase 3: Safe custom Playbook authoring

Plan

- [`2026-08-02-safe-playbook-authoring-compiler.md`](2026-08-02-safe-playbook-authoring-compiler.md)

Required outcome

- Authoring sources compile to inert proposals only
- Raw text cannot become executable shell without explicit binding
- Unresolved authority blocks activation
- Creation and activation remain separate commands

### Phase 4: Documentation, proof, and external validation

Plan

- [`2026-08-02-documentation-demo-and-adoption-validation.md`](2026-08-02-documentation-demo-and-adoption-validation.md)

Required outcome

- Astro Starlight documentation consumes generated runtime data
- A maintained demo produces real blocked and passing traces
- GitHub Pages passes browser and accessibility gates
- Ten consented external repositories validate the supported journey

## Product design reference

- [`../specs/2026-08-02-dokion-product-adoption-design.md`](../specs/2026-08-02-dokion-product-adoption-design.md)

## Proposed PR sequence

### PR A: Product truth surface

Scope

- Canonical generated product surface
- Public claim validator
- README and onboarding correction
- Release truth gate

Exit gate

- No public command or product claim lacks evidence

### PR B: Verification contract

Scope

- Route `dokion verify` through declared verification gates
- Add negative controls proving schema validation alone cannot report verification success

Exit gate

- Passing and failing verification fixtures produce exact evidence and exit codes

### PR C: Secure Release Pack foundation

Scope

- Pack contract and built-in registry entry
- Supported profile resolver
- Inert project-specific proposal and authority summary

Exit gate

- Supported fixtures produce deterministic proposals with no placeholders

### PR D: Guided first-run command

Scope

- `dokion try secure-release`
- Exact digest acceptance
- Atomic activation
- Production engine execution
- Packaged pass and blocked acceptance journeys

Exit gate

- No execution without exact digest and actor

### PR E: Run Trace contract and projection

Scope

- `dokion.run-trace.v1`
- Verified projection
- Central readiness classification
- HARDENING.md migration to the trace source

Exit gate

- Completed, blocked, stale, tainted, and rollback fixtures project truthfully

### PR F: Run Trace CLI and exports

Scope

- `dokion trace`
- JSON, Markdown, and static HTML exports
- Lifecycle integration

Exit gate

- Every terminal run state produces safe deterministic trace artifacts

### PR G: Proposal-only authoring compiler

Scope

- Intent intermediate representation
- Exact capability and command binding
- Proposal compiler
- `dokion create` redesign
- Activation authority diff

Exit gate

- No authoring path writes active execution authority

### PR H: Generated documentation foundation

Scope

- Astro Starlight application
- Generated command, status, Pack, and Run Trace data
- First-run and proof pages

Exit gate

- Site builds from canonical generated data under `/dokion/`

### PR I: Demo, browser QA, and deployment

Scope

- Maintained demo repository
- Reproducible transcripts and traces
- Playwright, axe, performance budgets
- GitHub Pages deployment

Exit gate

- Deployed docs reproduce the maintained supported journey

### PR J: Adoption cohort and product decision

Scope

- Ten external repositories
- Sanitized cohort records
- Aggregate measures and limitations
- Decision on the next Pack and Registry investment

Exit gate

- Product decisions are based on observed use rather than stars or page traffic alone

## Parallel work policy

Registry infrastructure can continue in parallel only when all of these conditions hold

- It does not block Phase 0 through Phase 2
- It preserves install and activation separation
- It does not introduce marketplace claims before real data contracts exist
- It uses no more than one concurrent engineering lane while the first journey is incomplete

New general-purpose orchestration features, swarm features, or additional Packs remain paused until PR D and PR F pass their acceptance journeys

## Project leadership rules

- One behavior or contract per commit
- TDD for every runtime change with observed RED before implementation where practical
- No direct pushes to `main`
- Rebase merge or another history-preserving merge method for meaningful commits
- Every PR must be current with `main`
- Every PR must include exact verification commands and results
- Every PR must document rollback and migration behavior
- No CodeRabbit result may be claimed unless the GitHub app or CLI completed the review
- All CodeRabbit critical and major issues must be fixed or rejected with evidence before merge
- Every review thread must be resolved
- Security-sensitive PRs require the appropriate scoped security review
- Generated documentation and examples must be drift-checked

## Stop conditions

Pause the current PR when any of these occurs

- Runtime behavior contradicts the design authority model
- A public claim cannot be tied to executable evidence
- A test passes without proving repository effects or evidence
- A proposal or package gains execution authority implicitly
- A new command duplicates an existing production path
- A repair cannot prove rollback or bounded write scope
- A generated example requires hand editing to look successful

## Program completion gate

The program is complete only when a clean supported repository can

1. Install Dokion
2. Preview Secure Release without editing JSON
3. Inspect exact authority and commands
4. Accept the exact proposal digest with actor identity
5. Execute through the production engine
6. Receive a qualified Run Trace
7. Repeat the committed Playbook
8. Author a separate proposal without mutating active authority
9. Follow the same journey from deployed documentation

All nine steps must be covered by clean-install acceptance evidence tied to an exact release candidate commit
