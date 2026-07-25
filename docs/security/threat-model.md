# Dokion Repository Threat Model

## Overview

Dokion is a local Bun and TypeScript command-line runtime that executes a user-authored software hardening process against a Git repository. It validates an active `.dokion/playbook.json`, runs declared capabilities and commands in order, captures findings and evidence, validates repairs, restores rejected changes, evaluates coverage and release gates, and renders human and machine state.

The primary product surfaces are:

- the installed `dokion` package and command-line entrypoint in `src/cli.ts`
- compiled standalone binaries built by `scripts/build-release.ts`
- the execution engine in `src/engine/`
- active playbook loading and digest checks in `src/playbook/`
- capability command execution and repair handling
- state, events, approvals, findings, evidence, reports, and repair snapshots under `.dokion/`
- the generated `HARDENING.md` report
- JSON Schema contracts under `schemas/`
- Claude Code, Codex, Gemini CLI, and ordinary shell adapters
- package, binary, CI, and release workflows

Dokion is not a hosted service, authentication provider, sandbox, scanner, secret manager, or deployment platform. Its most important security property is that it must not convert untrusted repository or capability content into execution authority.

This model is repository-scoped. It describes the whole Dokion product and its release surfaces rather than a finding about one pull request or one changed file.

### Protected assets

The assets that matter most are:

1. **Execution authority**
   - the exact active playbook content and digest
   - declared capability identities, order, modes, permissions, approvals, retries, stops, verification commands, and release gates
   - the rule that catalog entries and recommendations remain inert

2. **Repository integrity**
   - target source files and existing uncommitted work
   - declared write scopes
   - test files and verification configuration
   - the exact pre-repair state required for rollback

3. **State and audit integrity**
   - `.dokion/state.json`
   - `.dokion/events.ndjson`
   - approval and skip decisions
   - normalized findings
   - evidence and repair transaction artifacts
   - capability lock and provenance records
   - `HARDENING.md` and machine-readable reports

4. **Secrets and private data**
   - environment variables and credentials available to the invoking process
   - private repository paths and source content
   - registry tokens, cloud credentials, agent credentials, and MCP configuration
   - scanner output that may contain secrets or proprietary code

5. **Distribution integrity**
   - package metadata and exact tarball contents
   - standalone binaries and checksums
   - release tags, GitHub releases, and registry publication
   - adapter manifests and canonical skill content
   - CI workflow permissions and release environment secrets

6. **Security claims**
   - finding status and verification evidence
   - coverage and readiness statements
   - platform guarantees and degradations
   - the relationship between a report and the exact repository commit, playbook, capability lock, and evidence set

## Threat Model, Trust Boundaries, and Assumptions

### Security invariants

Dokion must preserve these repository-wide invariants:

1. `.dokion/playbook.json` is the sole execution authority.
2. An undeclared capability, command, repair, commit, publication, release, or deployment action never executes.
3. Catalog entries, generated proposals, skill text, scanner output, issue bodies, dependency metadata, and model recommendations remain untrusted data.
4. The active playbook cannot change during a run without detection and a tainted or stale boundary.
5. Approval is explicit, typed, scoped, append-only, and tied to the applicable subject and run.
6. A command receives only the permissions and environment allowed by the active declaration and runtime policy.
7. A repair stays inside its write scope, does not add suppression, does not weaken or delete tests, and can be restored exactly if rejected.
8. A finding reaches a verified state only when repair, adversarial validation, regression evidence, and declared verification all pass.
9. State, events, evidence, reports, and release claims remain attributable to an exact run, playbook digest, repository identity, and commit.
10. Secrets are not persisted to repository files, state, events, reports, package archives, binaries, or public CI artifacts.
11. Platform enforcement differences are recorded as cross-agent degradation rather than hidden behind equivalent-looking adapters.
12. A successful hardening run does not implicitly authorize commit, merge, publish, release, or deploy operations.
13. A readiness statement remains qualified and never implies coverage for work that was not declared and executed.

### Trust boundaries

#### Boundary 1: User authority to Dokion runtime

The user controls the active playbook and explicit decisions. Dokion is trusted to validate and enforce those declarations, but not to invent or broaden them.

Security failure examples:

- the runtime infers approval from conversational wording
- a default or catalog entry silently becomes enabled
- a missing tool is replaced with another tool
- a planned command becomes callable without an approved implementation boundary

#### Boundary 2: Dokion runtime to target repository

Dokion reads a repository that may be malicious, compromised, or simply malformed. Repository content is not trusted to instruct the runtime.

Security failure examples:

- a repository file injects agent instructions that cause extra commands
- path traversal or symlink handling escapes the repository root
- a repair overwrites unrelated dirty work
- generated output is treated as verified source evidence

#### Boundary 3: Dokion runtime to declared capability

A scanner, skill, plugin, agent, MCP server, or ordinary executable may be buggy, compromised, or intentionally hostile. Its output and documentation are data. Only its user-approved invocation receives authority.

Security failure examples:

- poisoned skill instructions request installation or privilege expansion
- scanner output contains shell syntax that is executed
- a capability writes outside its declared scope
- capability provenance differs from the approved lock

#### Boundary 4: Parent process environment to child command

The invoking shell may hold sensitive credentials and dangerous loader variables. Child processes are untrusted unless their environment is explicitly bounded.

Security failure examples:

- full environment inheritance exposes cloud or registry tokens
- shell injection changes the executable or arguments
- a timed-out process leaves descendants running
- unbounded output exhausts memory or captures secrets

#### Boundary 5: Mutable filesystem to persisted Dokion state

State, events, findings, evidence, and reports are local files that another process or user may modify. File existence alone is not proof of integrity.

Security failure examples:

- state tampering changes a failed step to succeeded
- an approval record is inserted or altered
- evidence is replaced after verification
- event deletion hides a forbidden action
- an interrupted atomic write leaves valid-looking partial state

#### Boundary 6: Source repository to package and binaries

Release automation translates source into a registry archive and standalone executables. The release must correspond to the tagged source and validated dependency graph.

Security failure examples:

- a compromised release workflow publishes different content from the validated archive
- credentials or private paths enter the package
- a mutable dependency or unpinned action changes the build
- checksums cover different files from the uploaded release
- one platform binary is untested but presented as equivalent

#### Boundary 7: Canonical workflow to agent adapters

Claude Code, Codex, Gemini CLI, and ordinary shell execution expose different hooks, isolation, and discovery behavior. Thin adapters are trusted only to expose the canonical workflow and report available guarantees.

Security failure examples:

- an adapter grants authority not present in the canonical skill
- a platform is reported as having hook enforcement when it does not
- cross-agent resume ignores weaker guarantees
- adapter commands drift from the runtime CLI

### Attacker-controlled inputs

Inputs that may be fully attacker-controlled include:

- source files, filenames, symlinks, Git metadata, ignored files, generated files, and repository configuration in the target project
- active playbooks supplied from an untrusted source, even though activation itself is operator-controlled
- capability output, exit text, SARIF, JSON, logs, findings, remediation suggestions, and documentation
- malicious playbook fields intended to exploit parsers, shell invocation, globbing, path handling, retries, or report rendering
- poisoned skill, plugin, agent, MCP, or dependency content
- package metadata, advisory text, CVE descriptions, issue bodies, pull request text, and commit messages
- archive filenames, package contents, and adapter manifests being inspected
- environment values when Dokion is invoked from a compromised shell or CI job
- concurrent filesystem changes made by another local process

### Operator-controlled inputs

The operator controls:

- which `.dokion/playbook.json` becomes active
- capability selection, immutable references, order, permissions, approvals, retries, stops, gates, and declared commands
- the repository and working tree on which Dokion runs
- environment allowlists and credentials made available to the process
- approval, rejection, skip, deferral, and risk-acceptance decisions
- whether generated proposals are reviewed and copied into a new active configuration
- release tags and protected environment approval

Operator control does not make content safe. A copied malicious playbook remains dangerous input and must pass schema, digest, permission, path, command, and policy validation.

### Developer-controlled inputs

Dokion maintainers control:

- source code, schemas, canonical skills, adapters, reference playbooks, tests, and documentation
- dependency versions and Bun lockfile updates
- CI and release workflows
- package allowlists, binary targets, and release scripts
- security policies, ADRs, threat model, and completion language

A compromised maintainer account, dependency update, action reference, or release environment is therefore a supply-chain threat rather than a normal target-repository threat.

### Assumptions

This model assumes:

- the operating-system account running Dokion already has the filesystem and process privileges that Dokion can exercise
- Git and Bun installations used by the operator are not already compromised
- GitHub repository, branch protection, and release environment controls behave as configured
- cryptographic hash primitives provided by the runtime are correct
- a local administrator can bypass local controls and is outside Dokion's containment promise
- Dokion does not provide a kernel sandbox for arbitrary declared commands
- an operator may deliberately approve dangerous work; Dokion must record and constrain the approval but cannot make an authorized hostile command safe

### Out-of-scope attacker stories

The following are outside the primary product threat boundary unless Dokion introduces the relevant feature:

- remote unauthenticated attacks against a hosted Dokion API, because the repository currently ships a local CLI rather than a network service
- browser XSS, CSRF, session theft, and multi-tenant authorization flaws, because Dokion has no web application or user session surface
- theft by an operating-system root or local administrator who can replace the executable, edit the repository, and alter all evidence
- compromise of Bun, Git, GitHub, the operating system, or the package registry as a whole, except where Dokion can reduce impact through pinning, checksums, provenance, and release verification
- vulnerabilities entirely inside a third-party scanner with no Dokion-specific authority, containment, evidence, or distribution consequence

These exclusions do not permit Dokion to hide resulting degradations. For example, a compromised external scanner remains relevant if Dokion executes it with excessive environment access or accepts its output as authority.

## Attack Surface, Mitigations, and Attacker Stories

### 1. Malicious playbook and authority expansion

**Attacker story:** An attacker supplies a malicious playbook that declares a shell command with broad write and environment access, weakens verification, or presents a generated proposal as active configuration.

**Relevant surfaces:**

- `schemas/dokion-playbook.schema.json`
- `src/playbook/load-playbook.ts`
- `src/engine/runtime-engine.ts`
- `src/approvals/`
- command registry and future policy modules

**Existing mitigations:**

- active playbook is a distinct user-owned file
- SHA-256 digest is stored and checked during execution
- catalog and proposals are inert
- declared order, applicability, approvals, retries, failure policy, and stop behavior are explicit
- Claude Code guard fails closed on playbook mutation during active states

**Remaining hardening:**

- stronger command and permission validation
- capability-lock resolution and provenance
- stale approval and stale run classification
- centralized approval and failure policy evaluation
- explicit environment, path, shell, network, and run-budget enforcement

### 2. Poisoned skill and prompt injection

**Attacker story:** A poisoned skill or plugin tells the agent to install another tool, ignore the playbook, read secrets, change tests, or report success without evidence.

**Relevant surfaces:**

- `skills/dokion-hardening/SKILL.md`
- `.claude/skills/`, `.agents/skills/`, `.codex/`, `GEMINI.md`
- capability documentation and output consumed by an agent

**Existing mitigations:**

- capability-local instructions are lower precedence than user and playbook authority
- canonical skill states that recommendations and undeclared installation are forbidden
- adapters are intended to remain thin
- active capability invocation is declaration-driven

**Remaining hardening:**

- module and adapter contract tests
- immutable skill directory hashing
- cross-agent handoff tests
- independent audit of actual versus declared actions

### 3. Shell injection, argument injection, and environment abuse

**Attacker story:** A declared or interpolated command contains shell metacharacters, attacker-controlled filenames, command substitution, or unsafe environment variables that alter execution.

**Relevant surfaces:**

- `src/engine/command-runner.ts`
- capability command templates
- verification and remediation commands
- process environment and current working directory

**Existing mitigations:**

- commands are executed in a selected repository root
- timeouts and captured exit codes exist
- stdin is ignored
- output is stored as evidence

**Known limitations:**

- current command execution uses `bash -lc`
- the current runner inherits the parent environment
- stdout and stderr are buffered in memory
- timeout handling does not yet prove complete process-tree termination

**Planned mitigations:**

- argument-vector command specifications
- explicit platform command strategies
- environment allowlists and dangerous-variable denylists
- output spooling and byte caps
- process-tree termination and cancellation evidence

### 4. Path traversal, symlink escape, and filesystem ambiguity

**Attacker story:** A repository uses `..`, absolute paths, alternate separators, case collisions, symlinks, hard links, or renamed roots to cause an allowed write to escape its scope.

**Relevant surfaces:**

- repair write scopes
- `src/validation/repair-snapshot.ts`
- `src/validation/repair-validator.ts`
- evidence and state paths
- package archive inspection

**Existing mitigations:**

- repair snapshots compare tracked and non-ignored untracked paths
- validation rejects changed paths outside declared globs
- Claude guard rejects noncanonical and symlinked active playbooks
- package validation applies required and forbidden path policies

**Known limitations:**

- generic write-scope canonicalization is not yet centralized
- ignored untracked trees are not covered unless explicitly bounded
- binary and oversized rollback behavior requires stronger contracts
- Windows case and separator semantics need dedicated tests

### 5. Repair suppression, test weakening, and rollback failure

**Attacker story:** A repair silences a scanner, adds an ignore directive, deletes or skips a test, makes a broad unrelated change, or leaves a partially applied mutation after verification failure.

**Relevant surfaces:**

- `src/engine/capability-runner.ts`
- `src/validation/repair-validator.ts`
- `src/validation/repair-snapshot.ts`
- finding lifecycle and verification evidence

**Existing mitigations:**

- suppression patterns are compared before and after repair
- deleted tests and added skip directives are detected
- changed regression-test evidence is required when configured
- out-of-scope paths and diff-size limits are checked
- failed repair, adversarial validation, or verification restores the pre-repair snapshot

**Remaining hardening:**

- transaction manifests linking intent, mutation, verification, and rollback
- binary, large-file, ignored-file, Unicode, and symlink fuzz cases
- process interruption during repair and rollback
- independent evidence audit

### 6. State tampering and evidence forgery

**Attacker story:** A local process edits state to mark steps successful, inserts an approval, removes a failure event, swaps evidence, or changes a report after verification.

**Relevant surfaces:**

- `src/state/state-store.ts`
- `src/state/event-log.ts`
- approval and finding stores
- evidence files and report generation

**Existing mitigations:**

- atomic JSON utilities are used for important state writes
- events are append-oriented
- reports are regenerated from state
- playbook digests and evidence paths are persisted

**Known limitations:**

- no exclusive run lock
- no monotonic compare-and-swap state revision
- no event hash chain
- no schema-versioned state migration layer
- no complete evidence manifest and independent audit command

**Planned mitigations:**

- exclusive locking and stale lock recovery
- state revisions and checkpoint boundaries
- schema-valid events with sequences and digest chaining
- evidence manifests and checksums
- state, event, evidence, report, lock, and repository reconciliation

### 7. Secret leakage and private-data exposure

**Attacker story:** A child command receives unrelated credentials, prints a token, records private source in evidence, or packages a local path or secret into a release artifact.

**Relevant surfaces:**

- inherited environment
- command stdout and stderr
- evidence and reports
- package and binary assets
- CI logs and uploaded diagnostics

**Existing mitigations:**

- repository rules prohibit storing credentials and private MCP configuration
- package validation searches for common secret signatures and private local paths
- CI checks for `.env`, `.npmrc`, `bunfig.toml`, generated state, and package residue
- release token is supplied through a protected environment and unset after publication
- compiled binaries disable automatic dotenv and bunfig loading

**Known limitations:**

- command environment inheritance is currently broad
- output redaction and structured secret classification are incomplete
- arbitrary capability output may contain proprietary data even when no token pattern matches

### 8. Compromised release and dependency supply chain

**Attacker story:** A compromised dependency, GitHub Action, release token, tag, workflow, or builder produces an archive or binary different from what CI validated.

**Relevant surfaces:**

- `package.json` and `bun.lock`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `scripts/build-release.ts`
- distribution and package smoke tests

**Existing mitigations:**

- frozen Bun dependency installation
- exact package archive inspection
- clean installation from the produced tarball
- five explicit binary targets and a clean-directory binary check
- package, Gemini extension, and tag version reconciliation
- protected `npm-release` environment
- immutable package-version check before publication
- SHA-256 release checksums

**Remaining hardening:**

- commit-pinned workflow actions
- dependency, code, secret, and license gates
- SBOM and artifact inventory
- GitHub build provenance attestations
- stronger partial-release and rollback behavior
- native host smoke tests for supported platforms

### 9. Cross-agent degradation and adapter drift

**Attacker story:** A run starts with Claude Code hook enforcement and resumes through a weaker adapter without recording the loss, or an adapter exposes commands or authority that differ from the canonical workflow.

**Relevant surfaces:**

- `src/platform/platform-detector.ts`
- `skills/dokion-hardening/SKILL.md`
- Claude, Codex, and Gemini adapter files
- command registry and adapter manifests

**Existing mitigations:**

- explicit `DOKION_AGENT` takes precedence
- conflicting platform signals resolve conservatively
- guarantees require explicit evidence variables
- missing hook, subagent, parallel-write, and worktree guarantees are recorded as degradations
- command parity tests cover current runtime and Gemini files

**Remaining hardening:**

- canonical adapter contract suite
- explicit guarantee negotiation probes
- complete Gemini and Codex command packaging
- cross-agent resume with stale or weaker guarantee decisions
- operating-system matrix tests

### 10. Denial of service and resource exhaustion

**Attacker story:** A command produces unbounded output, creates many files, hangs descendants, generates thousands of findings, or forces expensive snapshots and report rendering.

**Relevant surfaces:**

- command runner
- repair snapshots
- finding normalization
- evidence store
- report rendering

**Existing mitigations:**

- command timeouts exist
- repair diff-size policy can reject oversized changes
- execution iteration fields and retry counts exist in contracts

**Remaining hardening:**

- run budgets for commands, repairs, findings, evidence bytes, changed lines, and wall time
- bounded ignored-file collection
- output spooling and truncation
- performance budgets for large events, findings, snapshots, and reports
- process-tree cleanup on timeout and signals

### Realistic attacker stories

The most realistic security stories are:

- a hostile or compromised target repository manipulates paths, filenames, configuration, or agent-readable text
- a malicious capability or poisoned skill attempts to expand authority or exfiltrate environment data
- an operator activates an unsafe playbook copied from an untrusted source
- a local concurrent process changes files or Dokion state during a run
- a dependency or release workflow compromise changes shipped artifacts
- a weaker agent adapter is treated as equivalent to a stronger one

The likelihood of remote exploitation is lower because Dokion is a local CLI, but impact can still be high because the process may have access to source code, credentials, shell execution, and publication workflows.

## Severity Calibration

Severity considers required attacker control, affected trust boundary, breadth of write or secret access, detectability, rollback reliability, and whether released artifacts or historical evidence become untrustworthy.

### Critical

A vulnerability is generally Critical when it enables an attacker without the corresponding user authorization to cross the core execution or release boundary with broad impact.

Examples:

- an undeclared capability or command can execute with repository write or credential access
- a malicious repository or capability can achieve shell injection that exposes signing, cloud, or registry credentials
- a compromised release path publishes attacker-controlled package or binary content while all required checks appear successful
- state and evidence can be forged to authorize release or deployment without detection
- a path or symlink escape permits arbitrary writes outside the target repository under the invoking user's privileges

A local administrator replacing the binary and all evidence is not a Dokion Critical vulnerability because that actor is outside the containment assumption.

### High

A vulnerability is generally High when it breaks an important authority, containment, repair, secret, or integrity guarantee but requires a declared run, local repository control, or narrower prerequisites.

Examples:

- playbook mutation or stale approval bypass continues a write-capable run
- a repair outside declared scope is accepted and cannot be restored exactly
- child environment inheritance leaks sensitive but non-release credentials to an approved yet compromised scanner
- cross-agent handoff silently loses a blocking guarantee
- evidence replacement changes a verified finding or release-gate result without detection
- one distributed binary differs from validated source or package contents

### Medium

A vulnerability is generally Medium when it causes bounded integrity loss, denial of service, misleading non-blocking reporting, or a security footgun that still requires operator participation.

Examples:

- unbounded output or file enumeration exhausts memory without corrupting source or state
- a report omits a non-blocking degradation while machine state remains correct
- an unsafe default exposes more non-secret environment metadata than needed
- a malformed adapter command prevents a configured stage from running but does not execute extra work
- a stale historical report is presented without a freshness warning but does not alter active state

### Low

A vulnerability is generally Low when impact is limited to diagnostics, local inconvenience, minor information exposure, or defense-in-depth without crossing authority or integrity boundaries.

Examples:

- error output reveals a non-sensitive repository-relative filename already visible to the operator
- malformed optional metadata produces an unclear error but fails closed
- a documentation link or compatibility marker is stale while runtime enforcement remains correct
- a local denial of service requires the operator to intentionally approve and run an obviously pathological command

### Severity modifiers

Severity increases when:

- exploitation is triggered by ordinary repository inspection rather than an explicitly approved write command
- release credentials, private source, or multiple repositories are exposed
- evidence and audit trails are falsified
- the issue affects package and standalone binary consumers across platforms
- exploitation survives rollback or appears as verified success

Severity decreases when:

- the attacker must already control the operating-system account
- the dangerous behavior is exactly what the user explicitly declared and approved
- the failure is detected before any side effect and leaves complete evidence
- impact is limited to a test fixture, documentation-only path, or unsupported environment

## Maintenance

This threat model must be reviewed when Dokion adds a network service, remote execution, new package or binary distribution path, new agent adapter, capability installation, authentication, multi-user state, deployment action, or a material authority-model change.

A change to the sole playbook authority model or Bun-only repository runtime requires a superseding ADR as defined under `docs/adr/`.

Repository: imMamdouhaboammar/dokion  
Version: b54f3e0f8cd45560c4933a733bb2a6369d4a0e2b
