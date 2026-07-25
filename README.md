# Dokion

**Your rules. Your tools. Proven software.**

Dokion is a cross-agent hardening engine for Claude Code, Codex, and Gemini CLI. You declare
which capabilities run, in what order, with what permissions, and behind which approvals.
Dokion executes that plan, captures evidence for every claim, and writes a readiness report
that can be audited line-by-line against the plan you approved.

It never selects, installs, substitutes, reorders, or enables anything on its own.

> **Status: spec-stage.** This repository defines the system; it does not implement it yet.
> [`SPEC.md`](SPEC.md) is the specification. [`dokion.json`](dokion.json) is the identity and
> procedures manifest. [`templates/BUILD_PROMPT.md`](templates/BUILD_PROMPT.md) is a
> self-contained prompt you can hand to a coding agent to build it.

---

## The problem

Ask a coding agent to "harden this project" and the failure mode is predictable. It audits
broadly, fixes shallowly, silences whatever still complains, and reports success. Nothing in
that loop distinguishes a repaired vulnerability from a suppressed warning. And nothing
survives the context window — thirty steps of tool output later, the agent no longer
remembers what it checked.

## Four mechanisms

**1. You own the process.** `.dokion/playbook.json` is authored by you and is the only file
that authorises execution. Dokion may validate it, verify capabilities against it, explain
why a step can't run, and *recommend* changes — never select, install, substitute, reorder,
or enable. Recommendations land in a separate section and change nothing until you accept
them.

**2. The file is the state.** `HARDENING.md` and `.dokion/state.json` are written before
they're needed. Agent context is expendable; these aren't. Kill the session mid-run and any
agent, on any model, resumes from disk with nothing lost.

**3. No unverified success.** A step advances only when a verification command exits 0 and
its output is stored as evidence. Never on the agent's assertion. Add a `# nosec` over a real
defect and the finding goes to `REPAIR_REJECTED`, not `VERIFIED`.

**4. Uncovered means uncovered.** Dokion tracks capability *lanes* — application security,
API contracts, database hardening, observability, supply chain, and so on. A lane with
nothing assigned to it caps readiness at `CONDITIONALLY_READY` until you either assign a
capability or acknowledge the gap by name. A hole in the audit is reported as a hole, not
rounded up to a pass.

## Why the authority model is the security model

Snyk's [ToxicSkills study](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/)
found prompt injection in 36% of tested agent skills and 1,467 malicious payloads. The
barrier to publishing one is a `SKILL.md` and a week-old GitHub account.

An orchestrator that picks its own capabilities has to be *trusted* about what it picked. An
orchestrator that can only execute a list you wrote is *auditable* — you diff the playbook,
and the final report has to reconcile against it. That is why `.dokion/capabilities.lock.json`
has no selection, substitution, or installation authority: it only verifies what you already
chose.

## The two-file split

| File | Owner | What it is |
|---|---|---|
| `dokion.json` | ships with Dokion | **Catalog.** Identity, known capabilities, loop templates, policies, coverage gaps. Nothing in it executes. |
| `.dokion/playbook.json` | **you** | **Authorisation.** The capabilities you approved, in the order you chose, with the permissions you granted. |

Knowing about a capability is not enabling it. Every catalog entry ships
`default_enabled: false` and `requires_user_approval: true` — encoded as schema constants, so
the invariant cannot drift.

## What's in this repository

```
dokion.json                              identity + procedures manifest (the catalog)
SPEC.md                                  the specification
schemas/
  dokion-manifest.schema.json            validates dokion.json
  dokion-playbook.schema.json            validates .dokion/playbook.json
  dokion-state.schema.json               validates .dokion/state.json
  dokion-finding.schema.json             the normalized finding envelope
  capability-lock.schema.json            validates .dokion/capabilities.lock.json
  conformance_test.py                    proves the schemas enforce the authority model
playbooks/
  example.playbook.json                  minimal three-stage playbook
  reference/                             opt-in domain libraries — inert until copied
    web-fullstack.playbook.json
    api-service.playbook.json
    library-package.playbook.json
templates/
  HARDENING.template.md                  the report
  BUILD_PROMPT.md                        master prompt for building the implementation
```

## The authority model is enforced, not just documented

A specification that only *describes* its guarantees is a wish. These are encoded in the
schemas, so violating them is unrepresentable rather than discouraged:

```bash
pip install jsonschema && python3 schemas/conformance_test.py
```

The negative suite asserts the schemas **refuse** what the model forbids — a playbook that
grants itself `automatic_installation`, a manifest whose `forbidden_autonomy` list drops
"reorder steps", a catalog entry shipping `default_enabled: true`, a capability pinned to
`latest`, a finding marked `VERIFIED` with no evidence, a risk accepted with nobody on the
record. If any of those were accepted, the guarantee would be prose.

## Runtime layout

```
HARDENING.md                    the report
.dokion/
  playbook.json                 yours. write-blocked. sha256-pinned per run.
  playbook.proposed.json        the only playbook file Dokion may write
  state.json                    machine state
  capabilities.lock.json        resolution, digests, installer exceptions
  events.ndjson                 append-only event stream
  findings/  evidence/  reports/  runs/
```

## Getting started (once implemented)

There is no playbook by default, and Dokion will not invent one.

```bash
dokion init          # create state + HARDENING.md, install nothing
dokion inspect       # detect the stack, propose nothing
dokion plan          # write .dokion/playbook.proposed.json, then stop
# review it, edit it, then activate it yourself:
cp .dokion/playbook.proposed.json .dokion/playbook.json
dokion validate      # resolve and verify every declared capability
dokion run           # execute, gated by your approval policies
```

Or adopt a reference playbook instead of generating one:

```bash
mkdir -p .dokion
cp playbooks/reference/web-fullstack.playbook.json .dokion/playbook.json
# then: replace every sha256:PLACEHOLDER, replace the REPLACE_WITH_* commands,
# and delete every step you don't want. What you leave in, you have chosen.
```

## Cross-agent support

| | Claude Code | Codex | Gemini CLI |
|---|---|---|---|
| Playbook authority, digest pinning, evidence gates, state recovery | ✅ | ✅ | ✅ |
| Hook-based write prevention | ✅ | detection only | detection only |
| Subagent scope isolation | ✅ | detection only | detection only |
| Parallel isolated writers | ✅ | — | — |

Where a guarantee is unavailable, the run records it and the report says so. No implied
parity.

## Related

[Superpowers](https://github.com/obra/superpowers) governs how you *build new code*. Dokion
governs how you *prove code you already have*. They compose — Dokion's catalog lists
Superpowers as a capability like any other: pinned, verified, scoped, and off until you
approve it.

## License

MIT
