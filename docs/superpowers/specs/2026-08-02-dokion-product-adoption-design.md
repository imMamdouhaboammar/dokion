# Dokion Product Adoption Program Design

## Decision

Dokion will use software hardening as the first product wedge while preserving the broader long term identity of a user-directed execution control layer for coding agents

The product will not lead with Registry architecture, swarm language, or a generic claim that it runs every engineering workflow

The first public promise is narrower and testable

> Coding agents can do the work
>
> Dokion makes them follow the process and prove the result

## Product category

Primary category

`Agent Execution Control`

Supporting description

`A runtime for repeatable, stateful, evidence-backed engineering playbooks across coding agents and local tools`

The product is not positioned as another coding agent, a security scanner, a Skill marketplace, or a hosted workflow service

## Initial customer problem

The first target user already uses Claude Code, Codex, Gemini CLI, or another coding agent for repository work and has experienced at least one of these failures

- The agent claimed completion without running the required checks
- The agent changed files outside the intended scope
- A long session lost context or stopped before the workflow finished
- A repair removed or weakened a failing test
- The user could not reconstruct what happened after the run
- The user had no reliable rollback boundary

## Product wedge

The first packaged journey is `Secure Release`

It inspects a repository, proposes a bounded playbook, requires explicit activation, executes declared checks, records evidence, blocks unsupported completion claims, and produces a shareable run trace

The first release must support one well-defined project family before expanding

Selected first family

- Bun or Node TypeScript repositories with Git and a deterministic test or build command

Deferred families

- Python repositories
- Native mobile projects
- Polyglot monorepos with multiple independent release units
- Infrastructure repositories

## Product layers

### Dokion Runtime

The existing engine remains responsible for state, order, permissions, approvals, execution, evidence, verification, resume, and rollback

### Dokion Packs

A Pack is a curated product entry point that contains a Playbook template, applicability rules, project command resolution, required evidence, user-facing documentation, and acceptance fixtures

The first Pack is `secure-release`

### Dokion Run Trace

Every completed or stopped run produces a deterministic summary of what was attempted, what executed, what changed, what was accepted, what was rolled back, what remains blocked, and what evidence exists

### Dokion Registry

Registry work continues as distribution infrastructure but does not lead the initial product story

Registry completion is not a prerequisite for the first curated Pack because the Pack can ship inside the Dokion package and remain inert until explicit activation

## Truth boundary

No public claim may exist unless it is backed by at least one of these sources

- A registered CLI command and parser contract
- A runtime implementation path
- A negative control that proves failure behavior
- A passing acceptance fixture
- A generated command or capability snapshot
- A release artifact tied to an exact commit

The following wording requires explicit proof before it can appear publicly

- Multi-agent swarms
- Guaranteed subagent isolation
- Cross-agent portability without recorded degradations
- Automatic rollback for every failure class
- Verification of builds and tests when the active Playbook does not declare them
- Built-in import sources that the CLI currently interprets as filesystem paths
- Integrations that do not have package, adapter, or contract evidence

## Authority model

`.dokion/playbook.json` remains the sole execution authority

A guided first-run command may create a proposal and display an authority diff without execution

Execution can begin only after one of these explicit actions

- Interactive confirmation of the exact proposal digest and actor identity
- A non-interactive command that supplies the exact accepted digest and actor identity
- A separate activation command recorded through the existing approval and state contracts

The guided flow must not silently install capabilities, widen write scope, reorder steps, activate a different digest, or run after the proposal changes

## First-run journey

```text
Install Dokion
    ↓
dokion try secure-release
    ↓
Inspect project and resolve supported commands
    ↓
Create inert proposal
    ↓
Show stages, permissions, network access, shell commands, stop rules, and digest
    ↓
User accepts the exact digest
    ↓
Activate atomically
    ↓
Run through the production ExecutionEngine
    ↓
Generate Run Trace and qualified readiness statement
```

The target time from installation to the first useful proposal is under two minutes on the maintained fixture

The target time from explicit acceptance to a useful result is controlled by repository checks and must be displayed before execution when estimable

## Run Trace contract

The first version is `dokion.run-trace.v1`

Required sections

- Run identity and exact repository commit
- Active Playbook path and digest
- Agent and platform guarantees with degradations
- Ordered stage and step status
- Commands actually executed
- Evidence artifact references and checksums
- Findings by severity and lifecycle state
- Repairs accepted
- Repairs rejected and rolled back
- Approvals and skips with actor and reason
- Active blockers
- Qualified readiness statement
- Verification timestamp

Required output surfaces

- Human terminal summary
- Deterministic JSON
- Markdown report
- Self-contained static HTML export without remote scripts

## Safe Playbook authoring

The existing Creator path must become proposal-only

The authoring source can be Markdown, a transcript, a supported memory driver, or a structured draft

The compiler must output

- An inert proposal
- Validation diagnostics
- Authority summary
- Capability and command inventory
- Unresolved project bindings
- Exact digest
- Suggested activation command

The compiler must not overwrite `.dokion/playbook.json`

## Documentation architecture

The documentation site will use Astro Starlight after the product flows exist

Custom Store and Run Trace pages should reuse `StarlightPage` rather than rebuilding the application shell

Component overrides must preserve Starlight accessibility contracts, including the `_top` page title anchor, skip link, named layout slots, mobile navigation, and table of contents behavior

GitHub Pages must use the repository base path `/dokion/`

The docs must generate CLI references and status labels from canonical machine sources rather than duplicated prose

## Program workstreams

### Workstream 0

Truth audit and product surface reset

### Workstream 1

Secure Release Pack and guided first run

### Workstream 2

Run Trace and shareable evidence

### Workstream 3

Safe Playbook authoring compiler

### Workstream 4

Documentation, demo repository, and adoption validation

Registry install, activation, publishing, trust, and Store work remains a separate infrastructure program and may proceed in parallel only when it does not delay Workstreams 0 through 2

## Delivery order

1. Truth audit and command contract repair
2. Secure Release Pack proposal flow
3. Explicit activation and production engine execution
4. Run Trace contract and exports
5. Safe authoring compiler
6. Documentation and external validation cohort

## Product success measures

The first validation cohort contains ten external repositories not owned by the Dokion maintainer

Program targets

- At least 30 percent of installers reach a valid first proposal
- At least 20 percent of first-run users execute a second run within seven days
- Median time to first proposal under two minutes on supported repositories
- At least three runs prevent a false completion, out-of-scope repair, suppressed test, or unsafe release
- At least three user-authored Playbooks are created through the proposal-only compiler
- At least one public case study includes exact before state, run trace, blocker or accepted repair, and final qualified result

Built-in telemetry is not required for this validation phase

Cohort evidence may be collected manually or through explicit user-provided run bundles until a separate telemetry ADR is accepted

## Non-goals for this program

- Completing the full federated Store
- Ratings, downloads, rankings, or publisher badges
- Payments
- Automatic capability installation
- Automatic execution after package installation
- General-purpose workflow promises across every repository type
- Custom cryptography
- Mandatory hosted services
- Unbounded agent operation

## Program completion

The adoption program is complete when a clean supported repository can install Dokion, run the guided Secure Release journey, explicitly approve the exact proposal, execute through the production engine, receive a deterministic shareable Run Trace, and repeat the run using the committed Playbook without relying on unsupported documentation claims
