# Dokion — Specification

**Status:** Runtime baseline M0-M6 implemented.
**Specification version:** 1.0.0
**Tagline:** Your rules. Your tools. Proven software.

Production hardening backlog: in progress.

The implemented baseline is recorded in [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md). This status does not assert general production readiness for Dokion or for any repository evaluated by Dokion.

Dokion executes a **user-authored** hardening process against a codebase and produces a
readiness report that can be audited line-by-line against the process the user approved. It
runs on Claude Code, Codex, and Gemini CLI.

---

## Table of contents

0. [Files and ownership](#0-files-and-ownership)
1. [Problem, principles, non-goals](#1-problem-principles-non-goals)
2. [Authority model and precedence](#2-authority-model-and-precedence)
3. [The Playbook](#3-the-playbook)
4. [Bootstrap](#4-bootstrap)
5. [Enforcement](#5-enforcement)
6. [Capability resolution](#6-capability-resolution)
7. [The execution engine](#7-the-execution-engine)
8. [Subagents as permission enforcement](#8-subagents-as-permission-enforcement)
9. [Validation policy and anti-gaming](#9-validation-policy-and-anti-gaming)
10. [The journal](#10-the-journal)
11. [Completion and release readiness](#11-completion-and-release-readiness)
12. [Reference playbook library](#12-reference-playbook-library)
13. [Cross-agent adapters](#13-cross-agent-adapters)
14. [Build plan and test plan](#14-build-plan-and-test-plan)
15. [The CLI surface](#15-the-cli-surface)

---

## 0. Files and ownership

Dokion separates *what exists* from *what you authorised*. This split is the backbone of the
authority model: a catalog can be rich without being dangerous, because nothing in it runs.

| File | Owner | Role | Schema |
|---|---|---|---|
| `dokion.json` | ships with Dokion | **Catalog.** Identity, known capabilities, loop templates, policies, coverage gaps. Executes nothing. | [`dokion-manifest`](schemas/dokion-manifest.schema.json) |
| `.dokion/playbook.json` | **user** | **Authorisation.** Approved capabilities, order, permissions, gates. The only file that authorises execution. | [`dokion-playbook`](schemas/dokion-playbook.schema.json) |
| `.dokion/playbook.proposed.json` | Dokion | The one playbook file Dokion may write. Inert. | same |
| `.dokion/state.json` | Dokion | Machine run state. | [`dokion-state`](schemas/dokion-state.schema.json) |
| `.dokion/capabilities.lock.json` | Dokion | Resolution, digests, provenance, installer exceptions. | [`capability-lock`](schemas/capability-lock.schema.json) |
| `.dokion/events.ndjson` | Dokion | Append-only event stream. | — |
| `.dokion/findings/`, `evidence/`, `reports/`, `runs/` | Dokion | Artifacts. | [`dokion-finding`](schemas/dokion-finding.schema.json) |
| `HARDENING.md` | Dokion | The human report. | — |

Every catalog entry ships `default_enabled: false` and `requires_user_approval: true`, and
both are schema **constants** rather than defaults — so the invariant cannot drift as the
catalog grows. Knowing about a capability is not enabling it.

### 0.1 Loops are templates

`dokion.json` defines named loops (`bootstrap-and-inventory`, `disciplined-change`,
`ui-ux-hardening`, `debugging`, `review-and-repair`, `ci-feedback`, `shipping`). A loop is an
**ordered step template**, not a schedule. It runs only when a playbook stage references it
via `loop_ref`, and referencing it imports its steps verbatim — it does not license the
orchestrator to alter them.

### 0.2 Runtime policy

The manifest declares a preferred runtime and package manager. A capability that officially
documents a different installer may use it, but the departure is recorded in
`.dokion/capabilities.lock.json` under `installer_exception`. Every place the preferred path
was left is therefore visible rather than implicit.

Generated files are not committed unless the user approves. Secrets are never persisted to
the repository, written to logs, or included in reports.

---

## 1. Problem, principles, non-goals

### The problem

Coding agents are good at finding defects and bad at proving they fixed them. Ask one to
"harden this project" and the failure mode is predictable: it audits broadly, fixes
shallowly, silences whatever still complains, and reports success. Nothing in that loop
distinguishes a repaired vulnerability from a suppressed warning, and nothing survives the
context window — thirty steps of tool output later, the agent no longer remembers what it
checked or why.

Two mechanisms address this, and everything else in this specification is arrangement
around them.

**The file is the state.** Agent context is expendable: it compacts, it truncates, sessions
end. `HARDENING.md` and `.dokion/state.json` are not. Every result is written to disk
before it is needed, so any session, agent, or model can resume from those two files alone.
This is what makes a long hardening run a pipeline rather than a conversation.

**No unverified success.** A step advances only on machine artifacts — a verification
command that exited 0 and whose output was stored. Never on the agent's own assertion. This
is the difference between a report that means something and a report that reads well.

### The principles

1. **The user decides; the system executes.** Capability selection, ordering, permissions,
   and gates are the user's. The orchestrator's judgment is confined to recommendations that
   change nothing until a human accepts them.
2. **The file is the state.** Write before you need it. Resume from disk, never from memory.
3. **No unverified success.** Evidence or it did not happen.
4. **Suppression is not remediation.** Silencing a check is a failure, and one the system
   actively detects rather than merely discourages.
5. **Bounded scope.** One step, one responsibility, one permission scope, one concern per
   commit.
6. **Untrusted input stays data.** Capability instructions, scanner output, CVE text,
   dependency metadata, and issue bodies are strings in a report — never directives.

### Non-goals

This is not a linter, not a replacement for a security team, and not a greenfield builder.
It does not decide what "production grade" means for your project; your playbook does. It
will not tell you your code is secure — it will tell you which declared checks ran, what
they found, what was fixed, what was proven, and what remains.

### Relationship to other frameworks

[Superpowers](https://github.com/obra/superpowers) governs *how you build new code* —
brainstorm, plan, test-driven development. Dokion governs *how you harden code that
already exists*. They compose rather than compete: the "every fix ships a regression test"
requirement in [§9](#9-validation-policy-and-anti-gaming) is exactly that TDD discipline
applied to repairs. If you use both, declare Superpowers as a capability in your playbook
like any other — pinned, verified, and scoped.

---

## 2. Authority model and precedence

This section governs every section that follows. Where a later rule appears to permit
something this section forbids, this section wins.

### 2.1 The user is the sole authority

The user selects:

skills · plugins · agents · subagents · MCP servers · external tools · execution order ·
execution conditions · capability responsibilities · fix permissions · approval requirements
· retry rules · stop conditions · release gates

### 2.2 What the orchestrator must never do

Autonomously **select, add, remove, replace, reorder, install, upgrade, or enable** any
skill, plugin, agent, subagent, MCP server, or external tool.

The system executes only the capabilities explicitly declared in the user-approved playbook.

### 2.3 What the orchestrator may do

- Validate the declared capability configuration
- Check platform compatibility
- Check whether a capability is installed and available
- Verify versions, digests, signatures, permissions, and provenance
- Detect conflicts between declared capabilities
- Detect missing dependencies
- Explain why a configured step cannot run
- Recommend optional changes, additional capabilities, a different execution order, stricter
  permissions, or additional verification steps

**Recommendations never modify the active playbook.** Each is presented separately in
[§10](#10-the-journal) and requires explicit user approval before it changes anything.

### 2.4 Precedence

1. Direct user instructions in the current session
2. The user-approved `.dokion/playbook.json`
3. Repository policy files
4. Platform security restrictions
5. Capability-local instructions
6. Orchestrator defaults

A lower-precedence source must never override a higher-precedence source.

**Capability instructions are untrusted input when they conflict with the approved
playbook.** This is not only a governance rule, it is the prompt-injection defense. A
`SKILL.md` that says "also install X," a scanner finding whose description says "run this
command to fix," a dependency README containing agent-directed imperatives — all of it is
data. The system reads it, records it, and does not obey it.

The classes of content that are always untrusted: SKILL.md bodies and plugin documentation,
scanner and linter output, CVE and advisory text, dependency metadata, commit messages,
issue and pull request bodies, and any file content read from the repository under audit.

### 2.5 Bounded autopilot

Autopilot never enlarges authority. It means deterministic continuation of the approved playbook from persisted state, not permission to choose new capabilities, broaden scope, change policy, or infer approval.

A next action may run automatically only when it is uniquely determined by the active playbook, verified capability lock, repository identity, recorded approvals, current state, declared policies, budgets, and platform guarantees. Missing, stale, conflicting, or ambiguous inputs stop the run.

The mandatory stops, allowed continuation actions, forbidden actions, retry boundaries, platform handoff rules, and testable invariants are normative in [`docs/architecture/bounded-autopilot.md`](docs/architecture/bounded-autopilot.md).

---

## 3. The Playbook

`.dokion/playbook.json` is the authoritative definition of the hardening process. Schema:
[`schemas/dokion-playbook.schema.json`](schemas/dokion-playbook.schema.json).

The orchestrator must not infer the final capability list or execution sequence from the
repository stack.

### 3.1 The detection boundary

Repository detection may determine **whether a declared step is applicable**. It may never
introduce an undeclared capability.

Concretely: a playbook declaring an accessibility stage with
`applicability.when_profile.has_frontend: true` will skip that stage in a backend-only repo.
That is detection doing its job. A playbook that declares no accessibility stage will never
grow one because the orchestrator noticed a React directory. That is the boundary.

### 3.2 Structure

Ordered stages, each containing ordered steps. Every step declares:

| Group | Fields |
|---|---|
| Identity | `id`, `name`, `capability` (type, id, workflow, version, source, `immutable_reference`, per-platform mapping) |
| Intent | `responsibility`, `mode`, `required`, `notes` |
| Sequencing | `depends_on`, `applicability` |
| Data | `inputs`, `outputs` |
| Authority | `permissions` (read, write, network, shell, env), `approval` |
| Rigor | `validation`, `verification`, `success_conditions`, `stop_conditions` |
| Control | `retry_count`, `maximum_iterations`, `timeout_seconds`, `failure_policy` |

### 3.3 Enumerated vocabularies

**Execution modes** — what a step is permitted to do:

| Mode | Meaning |
|---|---|
| `READ_ONLY` | Inspect only. Emits no findings. |
| `ANALYZE` | Emit findings. Never modify source. |
| `CONFIGURE` | Adjust project configuration only. Never application source. |
| `FIX_WITH_APPROVAL` | Modify source only after the configured approval. |
| `FIX_AUTOMATICALLY` | Modify source without per-fix approval. |
| `VERIFY_ONLY` | Run verification commands. Assert nothing else. |
| `REPORT_ONLY` | Render existing state. Touch nothing. |

**Failure policies** — what happens when a step fails:

`STOP_PIPELINE` · `STOP_STAGE` · `CONTINUE` · `REQUEST_USER_DECISION` · `MARK_BLOCKED`

**Approval policies** — when the user is asked:

`NEVER` · `FROM_PLAYBOOK` · `BEFORE_INSTALL` · `BEFORE_EXECUTION` · `BEFORE_WRITE` ·
`BEFORE_EACH_FIX` · `BEFORE_COMMIT` · `ALWAYS`

**Finding lifecycle** — where a finding can be:

`OPEN` · `VALIDATING` · `APPROVED_FOR_FIX` · `FIXING` · `FIXED_PENDING_VERIFICATION` ·
`VERIFIED` · `REPAIR_REJECTED` · `FALSE_POSITIVE` · `ACCEPTED_RISK` · `DEFERRED` ·
`BLOCKED` · `NOT_APPLICABLE`

`FIXED_PENDING_VERIFICATION` means a repair was applied but not yet proven. `VERIFIED`
additionally means every configured verification command passed *and* validation policy did
not reject the repair. **Only `VERIFIED` counts toward a release gate.**

`REPAIR_REJECTED` records that a repair was attempted and validation caught it as suppression
or as incomplete. It is deliberately distinct from `FALSE_POSITIVE` — which asserts the
finding was never real — and from returning to `OPEN`, which would erase the fact that gaming
was detected. Repair policy allows at most three attempts per finding, with rollback required
between them; a finding exhausting them lands in `BLOCKED`.

### 3.3.1 Coverage lanes

A *lane* is an area of assurance — application security, API contracts, database hardening,
performance benchmarking, observability, supply chain and release provenance, native mobile
security. `dokion.json` records which lanes its catalog covers and which it does not.

`coverage_policy` in the playbook decides what an uncovered lane costs you:

| Field | Effect |
|---|---|
| `blocking_lanes` | Must be `ASSIGNED` before readiness may exceed the cap |
| `acknowledged_gaps` | Lanes knowingly left uncovered, each with a named acknowledger and a rationale |
| `unassigned_lane_readiness_cap` | Highest readiness attainable while a blocking lane is unassigned (default `CONDITIONALLY_READY`) |

This exists because the most misleading hardening report is not one that lies about what it
found — it is one that stays silent about what it never looked at. A lane nobody assigned is
a hole in the audit, and it is reported as a hole rather than rounded up to a pass.

### 3.4 Step responsibility

Every step declares a single `responsibility` in one sentence: "Detect UI defects." "Review
API contracts." "Repair security findings approved by the user." "Generate an SBOM."

The orchestrator must prevent a capability from expanding beyond its declared responsibility
and permission scope. A SAST step that starts reformatting code has left its responsibility,
and that is a scope violation regardless of whether the reformatting was an improvement.

### 3.5 Structural validity is not executability

The sentinel `sha256:PLACEHOLDER` is schema-legal so reference playbooks can be validated in
CI. The runtime loader must **reject any playbook containing it** and name the unpinned
steps. A template that validates is not a template that runs.

---

## 4. Bootstrap

A new project has no playbook, and the orchestrator may neither author one nor fall back to
defaults. The resolution is a proposal path that cannot activate itself.

**Playbook absent.** Stop. Report that no playbook exists and name the schema path. Do not
infer a pipeline. Do not run "sensible defaults."

**User asks for a proposal.** Detect the stack and write
`.dokion/playbook.proposed.json` — and only that filename. For each proposed step, state
the rationale: why this capability, why this position in the order, why these permissions.
Then stop again.

**Activation.** A human moves or copies the proposal to `.dokion/playbook.json`. That
human action is what creates authority. Writing a proposal creates none.

The same applies to the reference library in [§12](#12-reference-playbook-library): those
files are inert until a person copies one in.

---

## 5. Enforcement

`"editable_by_orchestrator": false` is an instruction, and the agent has write access to the
repository. Instructions are not mechanisms. Two mechanisms back it.

### 5.1 Hook prevention

A `PreToolUse` hook hard-blocks Write, Edit, and Bash mutations targeting
`enforcement.protected_paths` — by default `.dokion/playbook.json` and `schemas/**`.

This is **Claude Code only**. Codex and Gemini CLI have no equivalent.

### 5.2 Digest pinning

At run start the orchestrator records the playbook's sha256 in `state.playbook.digest`.
Before every subsequent step it re-verifies. On mismatch:

- abort the pipeline
- set `run.status` to `TAINTED`
- record expected digest, observed digest, detection time, and the step it was detected before
- stop

`TAINTED` is terminal for that run. Everything after the detection point is untrusted, so
there is no partial-credit recovery — start a new run against the changed playbook.

Digest pinning is **portable to every agent**. Where hooks are unavailable it degrades from
prevention to detection, and the run records `NO_HOOK_ENFORCEMENT` so the report says so.

### 5.3 Scope enforcement

A step's declared `permissions` are its tool grant, not a description of intent. An attempt
to read, write, reach the network, or run a command outside that scope is recorded in
`scope_violations` and is a hard failure.

On Claude Code this is enforced by running the step in a subagent whose tool grant is
derived from the declared scope ([§8](#8-subagents-as-permission-enforcement)). Elsewhere it
degrades to detection, recorded as `NO_SUBAGENT_ISOLATION`.

### 5.4 Dirty worktree policy

Before a write-capable run creates state, Dokion evaluates `enforcement.worktree_policy`.
The allowed values are `clean-only`, `allow-existing-dirty`, and
`snapshot-existing-dirty`; an omitted value defaults to `clean-only`.

`clean-only` blocks before state mutation when Git reports pre-existing user changes.
`allow-existing-dirty` records paths, status, mode, and digests without copying file content.
`snapshot-existing-dirty` additionally records exact file bytes and symlink targets so the
pre-run tree can be distinguished from later Dokion changes. The baseline is scoped to the
project path relative to the Git top level and written atomically to
`.dokion/worktree-baseline.json`; sibling projects and Dokion-owned runtime paths are
excluded. Status, staged and unstaged patches, and entry digests are recaptured before the
baseline is accepted, including untracked files and symlinks.

Capture is bounded to 10,000 dirty entries, 64 MiB for one dirty file or Git output, and
128 MiB of raw exact-snapshot data. Exceeding a bound, losing Git state, or failing to
obtain an exact requested snapshot stops before state mutation. Resume-time attribution of
post-baseline Dokion changes remains part of checkpointed side-effect tracking.

### 5.5 What each agent actually gets

| Guarantee | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| Playbook write prevention | hook | — | — |
| Playbook mutation detection | digest | digest | digest |
| Step scope enforcement | subagent grant | detection | detection |
| Parallel isolated writers | worktrees | — | — |
| Evidence gates | yes | yes | yes |
| State recovery | yes | yes | yes |

---

## 6. Capability resolution

The capability lock is **not a recommendation engine and not a marketplace resolver.** It is a
verification and metadata source for capabilities the user already selected. Schema:
[`schemas/capability-lock.schema.json`](schemas/capability-lock.schema.json).

```json
"role": {
  "selection_authority": false,
  "substitution_authority": false,
  "installation_authority": false
}
```

A registry asserting any of these as `true` is invalid and must be rejected at load.

### 6.1 What the lock file records

Source location · supported platforms · version information · content digest · publisher
identity · signature or attestation · license · required permissions · required dependencies
· installation method · verification method · known limitations · known risks · current
trust status.

### 6.2 Resolution outcomes

Any outcome other than `VERIFIED` stops the dependent steps and reports the exact reason:

`AVAILABLE_UNVERIFIED` · `NOT_INSTALLED` · `INCOMPATIBLE_PLATFORM` · `VERSION_MISMATCH` ·
`DIGEST_MISMATCH` · `BLOCKED_BY_REGISTRY` · `PERMISSIONS_EXCEED_STEP` · `DEPENDENCY_MISSING`

**Substitution is never permitted.** If a declared capability is unavailable, the answer is
a stopped step with a stated reason — not a similar tool that happened to be installed.

`PERMISSIONS_EXCEED_STEP` deserves emphasis: when a capability's `required_permissions`
exceed what its step grants, the step stops and the excess is named. A capability does not
get to widen its own scope by declaring that it needs more.

### 6.3 Why this matters

Snyk's ToxicSkills study found prompt injection in 36% of tested agent skills and 1,467
malicious payloads across the ecosystem. The barrier to publishing one is a `SKILL.md` file
and a GitHub account a week old: no code signing, no security review, no sandbox by default.
Datadog's analysis of dynamic context makes it worse — where a skill can execute a command
before the model sees the content, model-level injection defenses never get a turn.

A tool whose entire proposition is *hardening* cannot ship an unvetted-install path. Hence:
declared capabilities only, pinned to digests, verified before execution, and executed inside
a declared scope.

---

## 7. The execution engine

### 7.1 The step lifecycle

For every user-declared step, exactly this sequence:

1. Load the exact step configuration.
2. Confirm that all declared dependencies have completed.
3. Verify the capability identity and version.
4. Verify the capability permissions.
5. Confirm applicability conditions.
6. Request approval when required.
7. Execute the capability in the configured mode.
8. Capture its outputs.
9. Normalize findings **without changing their meaning**.
10. Validate findings according to the configured validation policy.
11. Apply repairs only when the configured execution mode permits them.
12. Run the configured verification commands.
13. Store evidence.
14. Update machine state.
15. Update `HARDENING.md`.
16. Apply the configured success or failure policy.
17. Move to the next user-declared step.

Never repeat a step beyond its configured `retry_count` or `maximum_iterations`.

**On step 9.** Normalization reshapes heterogeneous tool output into the finding envelope in
[`schemas/dokion-finding.schema.json`](schemas/dokion-finding.schema.json). It maps
fields. It does not re-grade severity, relocate a finding, soften a description, or merge two
findings into one. Severity may only change through `severity_override`, which requires a
named approver and a rationale. Normalization that changes meaning is data falsification, and
it is the quietest way for a hardening report to become fiction.

### 7.2 Execution order

Stages and steps run exactly in the declared order. The orchestrator does not reorder based
on its own judgment — not for efficiency, not for dependency-looking hunches.

A step may run out of sequence only where the playbook explicitly declares parallel
execution, a dependency relationship, a conditional branch, a retry branch, or a recovery
branch.

Read-only parallel execution requires explicit enablement. Concurrent **writes** additionally
require all of:

- explicit enablement in the playbook
- an isolated git worktree per writer
- non-conflicting file scopes
- independent verification of each result
- a declared or approved merge order

Parallel writing is Claude Code only. Elsewhere, `PARALLEL` stages degrade to `SEQUENTIAL`
and the run records `NO_PARALLEL_WRITES`.

---

## 8. Subagents as permission enforcement

Separation of powers, where the tool grant is the guarantee rather than the instruction.

| Agent | Grant | Why it is separate |
|---|---|---|
| `hardening-orchestrator` | state files only; **no source edits** | Single writer of state. An agent that both grades the work and does the work will grade generously. |
| `capability-runner` | exactly the step's declared scope | Scope creep becomes impossible rather than discouraged. |
| `remediation-engineer` | edit + test, only in `FIX_*` modes | One finding at a time; must ship a regression test. |
| `verification-adversary` | read-only + shell | Its only job is to prove the fix is fake. |

The adversary is not always on. It is a **configurable validation policy**
(`validation.adversarial_verification`), enabled per step — consistent with the authority
model, where rigor is the user's setting and not the orchestrator's preference.

What the adversary does: re-runs the original detection independently, inspects the diff for
suppression patterns, checks that the regression test actually fails without the fix, and
looks for the defect reappearing in a neighbouring code path. Its verdict is one of
`FIX_HOLDS`, `FIX_IS_SUPPRESSION`, `FIX_INCOMPLETE`, or `NOT_RUN`. The middle two force the
finding back to `REJECTED_BY_VALIDATION`.

On agents without subagents, each role's constraints are enforced by the orchestrator
in-session and the run records `NO_SUBAGENT_ISOLATION`. This is a real reduction in
assurance and is reported as one.

---

## 9. Validation policy and anti-gaming

An agent under pressure to produce a green report will find the cheapest path to green. These
are the cheap paths, each with the heuristic that detects it.

| Failure | Detection |
|---|---|
| Suppression directive added | Diff introduces `# nosec`, `eslint-disable`, `# type: ignore`, `@ts-ignore`, `# noqa`, `#pragma warning disable` or equivalent on or adjacent to the finding's location |
| Ignore-file broadened | Diff adds paths or rules to `.semgrepignore`, `.gitleaksignore`, `.eslintignore`, scanner config `exclude` lists |
| Severity threshold lowered | Diff modifies scanner config to raise the minimum reported severity |
| Test deleted or skipped | Diff removes a test, or adds `.skip`, `xit`, `@pytest.mark.skip`, `t.Skip()` |
| Assertion weakened | Diff replaces a specific assertion with a looser one in a test covering the finding |
| Exception handler broadened | Diff widens a `catch`/`except` to swallow the error the finding describes |
| Success without artifact | Step reports `SUCCEEDED` with no stored evidence for a configured verification command |
| Refactor disguised as fix | Diff exceeds `validation.max_diff_lines`, or touches files unrelated to the finding's location |
| Out-of-scope edit | Write outside the step's declared `permissions.write` |
| Dependency added for a trivial problem | Diff adds a manifest entry to resolve a finding fixable in-file |
| Meaning changed in normalization | Normalized finding's severity, location, or rule id differs from the raw artifact without a recorded `severity_override` |

A detected attempt is recorded as a scope violation and the finding returns to
`REJECTED_BY_VALIDATION`. The system must not retry with a different suppression.

**Available policy switches:** `adversarial_verification`, `suppression_detection`,
`require_regression_test`, `require_evidence_artifact`, `forbid_test_deletion`,
`forbid_out_of_scope_edits`, `max_diff_lines`.

There is a legitimate case for each of these behaviours — a false positive genuinely does
warrant a suppression comment. The system's position is that the decision belongs to a human:
route it through `DEFERRED` or `ACCEPTED_RISK` with a named approver and a rationale, where
it lands in the residual risk register instead of disappearing.

---

## 10. The journal

`HARDENING.md` is the human record; `.dokion/state.json` is the machine record. The
orchestrator is the single writer of both. Template:
[`templates/HARDENING.template.md`](templates/HARDENING.template.md).

| § | Section | Purpose |
|---|---|---|
| 1 | Run metadata | Including playbook digest and `TAINTED` state |
| 2 | Project profile | Detected; gates applicability only |
| 3 | Declared capability manifest | Every declared capability and its resolution |
| 4 | Execution state | Stages and steps in declared order; skips with reasons |
| 5 | Findings ledger | With standard references and adversary verdicts |
| 6 | Approvals | Append-only |
| 7 | Scope violations | Hard failures |
| 8 | Evidence index | Every artifact backing every claim |
| 9 | Residual risk register | What remains open, and who decided so |
| 10 | **Suggested Playbook Changes** | Inert recommendations |
| 11 | Release gates | |
| 12 | Completion | Criterion-by-criterion |
| 13 | Run log | Append-only |

### 10.1 Suggested Playbook Changes

The orchestrator may raise:

missing review coverage · a capability that does not support the detected stack · a
capability with excessive permissions · conflicting steps · incorrect execution order ·
missing verification commands · missing release gates · duplicate capabilities · deprecated
capabilities · capabilities with unresolved security concerns

Each is presented separately. The user accepts, rejects, or edits. **Nothing here modifies
the active playbook** — the user updates `.dokion/playbook.json` by hand, and only between
runs, because a mid-run edit taints the run by design.

This section is where the orchestrator's judgment goes. It is deliberately the only place.

---

## 11. Completion and release readiness

### 11.1 Readiness statuses

| Status | Meaning |
|---|---|
| `NOT_READY` | A blocker is active. |
| `CONDITIONALLY_READY` | Gates passed, but a blocking lane is unassigned or a gap is acknowledged. |
| `READY_FOR_STAGING` | All configured gates passed for a staging target. |
| `READY_FOR_PRODUCTION` | All configured gates passed for a production target. |

**A single validated critical blocker outranks any aggregate score.** Readiness is not an
average, and a high score does not dilute one critical finding. Default blockers:

build failure · required test failure · unresolved merge conflict · validated critical
finding · validated high finding the user marked blocking · failed required user flow ·
missing required approval · capability executed outside approved scope · evidence tied to a
different commit

### 11.2 How the statement is phrased

The completion statement is always qualified against the configuration that produced it:

> This repository passed the user-configured Dokion gates at commit `<sha>`. Remaining
> limitations, manual checks, skipped steps, and accepted risks are recorded in `HARDENING.md`.

Dokion never emits an unqualified "production ready." It cannot honestly do so: it knows what
your playbook checked, not what your system needs. A report that overstates its own scope is
worse than no report, because it transfers confidence that was never earned.

### 11.3 Completion criteria

A run is complete when **all** of the following hold:

- Every required user-declared step has completed successfully
- Every configured verification command has passed
- Every configured release gate has passed
- No configured blocking finding remains open
- Required user approvals are recorded
- Declared manual reviews are complete
- Results are tied to an exact git commit
- The final report states which skills, plugins, agents, subagents, MCP servers, and tools
  were used
- The final report states the exact declared execution order
- The final report records skipped steps and their reasons
- The final report lists recommendations that were not applied
- No blocking coverage lane is unassigned and unacknowledged
- The readiness statement is qualified against the configuration that produced it

Each criterion is recorded individually in `state.completion.criteria` so the claim is
auditable rather than asserted.

> **Dokion must never claim completion based on checks or capabilities that were not
> declared in the user-approved playbook.**

This is the single most important prohibition in this document. A run that hardened
something real, but did it outside the playbook, is a failed run — not a successful one with
a bonus. The value of the report is that it corresponds exactly to a process a human chose;
work outside that process destroys the correspondence, however good the work was.

### 11.4 Dokion runtime production readiness

Dokion runtime production readiness is a claim about the Dokion product and its exact release candidate. It requires evidence across authority safety, recovery integrity, command containment, auditability, supported platforms and agents, distribution integrity, seeded fixtures, and operational documentation.

A target repository readiness result remains scoped to its exact repository commit, approved playbook, capability lock, platform guarantees, gates, evidence, degradations, and acknowledged gaps. It does not become a general security or production-readiness claim.

The proof lanes, release gates, claim grammar, freshness rules, forbidden claims, and production-backlog exit criteria are normative in [`docs/architecture/production-readiness.md`](docs/architecture/production-readiness.md).

---

## 12. Reference playbook library

Opt-in and inert. Copy one to `.dokion/playbook.json`, pin every `sha256:PLACEHOLDER`,
replace the `REPLACE_WITH_*` commands, and delete every step you do not want. Steps you leave
in are steps you have chosen.

| Playbook | For |
|---|---|
| [`web-fullstack`](playbooks/reference/web-fullstack.playbook.json) | Full-stack web application |
| [`api-service`](playbooks/reference/api-service.playbook.json) | Backend service, no frontend |
| [`library-package`](playbooks/reference/library-package.playbook.json) | Published library |

They declare ordinary CLI tools rather than third-party skills. That is deliberate: a binary
can be pinned, version-checked, and reproduced, whereas trusting a `SKILL.md` means trusting
its author ([§6.3](#63-why-this-matters)).

### 12.0 These playbooks fill lanes the catalog leaves open

The shipped `dokion.json` catalog is strong on project intelligence, planning, semantic
editing, UI auditing, review, and CI — and it records, honestly, that it has no dedicated
capability for several assurance lanes. The reference playbooks exist largely to close that
distance, by assigning ordinary pinned binaries to the open lanes:

| Lane | Catalog status | Assigned by the reference playbooks |
|---|---|---|
| application-security | `UNASSIGNED` | Semgrep (SAST) |
| supply-chain-and-release-security | `UNASSIGNED` | OSV-Scanner, Gitleaks, Trivy (SBOM) |
| api-security-and-contracts | `UNASSIGNED` | Semgrep rulesets + a manual authorization review step |
| database-hardening | `UNASSIGNED` | Migration-safety and tenancy-isolation review steps |
| observability | `UNASSIGNED` | Static logging review only — **partial**, and declared as such |
| performance-benchmarking | `PARTIAL` | Lighthouse lab metrics only — no load testing |
| mobile-native-security | `UNASSIGNED` | Not addressed |

Each reference playbook carries a `coverage_policy` naming which lanes it treats as blocking
and which gaps it acknowledges, with the acknowledgement left as `REPLACE-WITH-YOUR-NAME` so
adopting it is a deliberate act rather than an inherited default. The two lanes that stay
genuinely open — sustained-load performance and native mobile security — are acknowledged
rather than quietly dropped.

### 12.1 Domains and their standards

| Domain | Anchors |
|---|---|
| Supply chain | OSV; SBOM (CycloneDX / SPDX); SLSA provenance; license review |
| Secrets | Full git-history scanning; rotation as a separate human task |
| Security (code) | OWASP Top 10; **OWASP ASVS 5.0** (17 chapters, L1 → L2); CWE Top 25 |
| API | **OWASP API Security Top 10 2023**, API1 (BOLA) → API10 (Unsafe Consumption) |
| Data | Schema, migrations, indexes, N+1, tenancy / RLS, backup and restore |
| Performance | **Core Web Vitals at p75**: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1; bundle weight; caching |
| UI/UX + a11y | **WCAG 2.2 Level AA**; loading / empty / error states; i18n and RTL |
| Reliability | Timeouts, retries with backoff, idempotency, graceful degradation |
| Tests | Critical-path coverage; a regression test per fix |
| Observability | Structured logs, correlation ids, metrics, traces, health checks, secret redaction |
| CI/CD + IaC | Pipeline gates, container and IaC scanning, rollback, CI secret handling |
| AI safety | **OWASP Top 10 for LLM Applications**; tool-permission scoping |
| Docs + DX | README, runbook, ADRs, environment setup |
| Release | Final verification against the exact shipping commit |

Two honest notes carried in the playbooks themselves. Automated accessibility tooling
detects roughly a third of WCAG failures — colour, focus order, and meaningful labels need a
human, so the manual review step is doing real work. And BOLA/BFLA are authorization *logic*
defects that scanners detect poorly; the review step there is not redundant with the SAST
step.

---

## 13. Cross-agent adapters

### 13.1 Discovery and packaging

| | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| Skill paths | `.claude/skills/`, plugin `skills/` | `.agents/skills/` (cwd → repo root), `~/.agents/skills`, `/etc/codex/skills` | `.gemini/skills/`, `~/.gemini/skills`, `.agents/skills` alias |
| Project memory | `CLAUDE.md` | `AGENTS.md` | `GEMINI.md` |
| Packaging | plugin + `.claude-plugin/marketplace.json` | skill dirs + `agents/openai.yaml`, `[[skills.config]]` toggles | `gemini-extension.json` + `commands/*.toml` |
| Subagents | native (`agents/*.md`, `context: fork`) | none | none |
| Hooks | yes | no | no |

### 13.2 The portability rule

Canonical `SKILL.md` frontmatter uses **only** Agent Skills open-standard fields:

| Field | Required | Constraint |
|---|---|---|
| `name` | yes | 1–64 chars, lowercase `[a-z0-9-]`, no leading/trailing hyphen, no `--`, equals parent directory name |
| `description` | yes | 1–1024 chars; states what it does *and* when to use it |
| `license` | no | |
| `compatibility` | no | ≤ 500 chars |
| `metadata` | no | string → string map |
| `allowed-tools` | no | space-separated; experimental |

Claude-specific fields — `context: fork`, `agent`, `background`,
`disable-model-invocation`, `model`, `effort`, `hooks`, `paths` — live in a build-time
overlay, never in the canonical body. The same skill file then runs unmodified on all three
agents.

Keep `SKILL.md` bodies under ~500 lines and move reference material to `references/`, since
the whole body loads on activation.

### 13.3 The degradation ladder

**Weakens off Claude Code:** hook-based write prevention (→ digest detection), subagent
scope isolation (→ orchestrator-enforced detection), parallel isolated writers (→
sequential).

**Holds everywhere:** playbook authority, the precedence chain, digest pinning and `TAINTED`
detection, evidence gates, state recovery, the completion definition.

Every run records its own `degradations` list, and the report states them. A user comparing
two reports must be able to see that one had weaker enforcement than the other.

---

## 14. Build plan and test plan

### 14.1 Implemented milestone baseline

Runtime baseline: M0-M6 implemented. Each milestone is limited to behavior covered by code and CI at the audited baseline in [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md).

| M | Scope | Status | Audited acceptance evidence |
|---|---|---|---|
| **M0** | Schemas and validation CI | Implemented | Schemas, reference playbooks, and catalog contracts validate; malformed active playbooks and unresolved digest placeholders are rejected |
| **M1** | Loader, digest pinning, and enforcement guard | Implemented | Active playbook mutation is detected as `TAINTED`; Claude Code receives a fail-closed guard; weaker platforms record degradations |
| **M2** | Execution engine and journal | Implemented | Declared stages and steps execute in order with disk state, events, evidence, reporting, and resume |
| **M3** | Findings and remediation lifecycle | Implemented | Findings are normalized, approval-gated, repaired through declared commands, verified, and persisted with evidence |
| **M4** | Adversarial repair validation and readiness gates | Implemented | Out-of-scope edits, suppression, deleted tests, missing regression evidence, and failed verification reject and roll back repairs |
| **M5** | Cross-agent adapters | Implemented | One canonical hardening skill is packaged for Claude Code, Codex, and Gemini CLI with explicit platform degradations |
| **M6** | Distribution and release | Implemented | Embedded assets, exact package inspection, clean Bun installation, Gemini extension validation, five compiled binaries, and protected tag release automation pass CI |

Production hardening backlog: in progress. The next backlog adds missing CLI commands, stronger state integrity, capability provenance, bounded autopilot, module contracts, broader platform proof, and release attestations. This status does not assert general production readiness.

### 14.2 Testing with seeded defects

Correctness is not "the code runs." Build fixture repositories containing known,
intentionally seeded defects — an injectable query, a credential committed in git history,
an oversized bundle, a contrast failure, a missing rate limit — and assert:

1. All seeded defects are found.
2. A faked fix is caught by validation and never reaches `VERIFIED`.
3. A killed session resumes with zero lost state.
4. A playbook mutated mid-run aborts as `TAINTED`.
5. A capability invoked anywhere that the playbook does not declare fails the run.
6. The final report reconciles exactly against the declared playbook.

Tests 4, 5 and 6 test the authority model rather than the hardening. They matter most: a
system that hardens well but cannot prove it stayed inside its mandate has not delivered the
thing this specification is for.

---

## 15. The CLI surface

`dokion` is the binary. The commands divide cleanly into three groups by what they are
allowed to touch, and that division is itself part of the authority model: the commands that
observe cannot mutate, and the commands that mutate cannot run unapproved.

### 15.1 Observe — never writes project files

| Command | Purpose |
|---|---|
| `dokion inspect` | Detect the stack. Propose nothing. |
| `dokion doctor` | Check the environment and declared capability availability. |
| `dokion status` | Current run state. |
| `dokion findings` | The findings ledger. |
| `dokion report` | Render `HARDENING.md` from state. |
| `dokion tools list` · `skills list` · `plugins list` · `loops list` | Show the catalog. Listing is not enabling. |

### 15.2 Configure — writes only Dokion's own files

| Command | Purpose |
|---|---|
| `dokion init` | Create `.dokion/` and `HARDENING.md`. Installs nothing. |
| `dokion plan` | Write `.dokion/playbook.proposed.json` with a rationale per step, then stop. |
| `dokion configure` | Interactive edit of the proposal. |
| `dokion validate` | Validate the playbook; resolve and verify every declared capability. |
| `dokion reset --state-only` | Clear run state. Never touches the playbook. |

`dokion plan` is the only command that authors a playbook, and it can only write the
`.proposed` path. Activation is a human copying that file. There is no `--activate` flag, and
adding one would break the model.

### 15.3 Execute — gated by your approval policies

| Command | Purpose |
|---|---|
| `dokion run` | Execute the approved playbook. |
| `dokion step` | Execute a single declared step. |
| `dokion resume` | Continue an interrupted run from disk. |
| `dokion approve` · `reject` · `skip` | Record a decision. Every one lands in the approvals ledger. |
| `dokion verify` | Re-run verification against the current commit. |

`dokion resume` is the command that makes [principle 2](#the-principles) real: it reads
`.dokion/state.json` and `HARDENING.md`, and needs nothing from the previous session's
context. A run interrupted on Claude Code can be resumed on Codex.

### 15.4 What no command does

There is no `dokion install`. Installation is a human action, performed with the capability's
own documented installer, and recorded in `.dokion/capabilities.lock.json`. A binary that can
install its own tooling is a binary that can be talked into installing something else.

---

## References

**Format and platform**
- [Agent Skills specification](https://agentskills.io/specification) · [overview](https://agentskills.io/home)
- [Claude Code — skills](https://code.claude.com/docs/en/skills) · [plugins reference](https://code.claude.com/docs/en/plugins-reference) · [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Codex — build skills](https://learn.chatgpt.com/docs/build-skills)
- [Gemini CLI — extension reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md) · [skills](https://geminicli.com/docs/cli/skills/)

**Security context**
- [Snyk — ToxicSkills: prompt injection in 36% of skills, 1,467 malicious payloads](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
- [Datadog Security Labs — malicious skills and the risk of dynamic context](https://securitylabs.datadoghq.com/articles/malicious-skills-supply-chain-risks-in-coding-agents-with-dynamic-context/)

**Standards**
- [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x00-header/)
- [OWASP Application Security Verification Standard 5.0](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [Core Web Vitals](https://web.dev/articles/vitals)

**Related work**
- [obra/superpowers](https://github.com/obra/superpowers) · [vercel-labs/skills](https://github.com/vercel-labs/skills)
