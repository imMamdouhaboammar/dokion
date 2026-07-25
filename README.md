<div align="center">

# Dokion

### *Your rules. Your tools. Proven software.*

A user-directed hardening runtime for Claude Code, Codex, Gemini CLI, and ordinary shell capabilities.

[![Runtime: M0-M5](https://img.shields.io/badge/runtime-M0--M5%20implemented-2EA44F.svg?style=flat-square)](docs/superpowers/plans/2026-07-25-m5-cross-agent-adapters.md)
[![Bun](https://img.shields.io/badge/Bun-1.3.14-black.svg?style=flat-square&logo=bun)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

</div>

## Current status

Dokion is an executable Bun CLI with cross-agent packaging and explicit platform-degradation records.

Implemented:

- M0: schemas, conformance tests, and CI validation
- M1: immutable playbook loading and SHA-256 mutation detection
- M2: ordered execution, state journaling, evidence capture, reporting, and resume
- M3: normalized findings, approval records, declared remediation, and verification
- M4: snapshot-based adversarial repair validation and exact rollback
- M5: one canonical hardening skill, Claude Code/Codex/Gemini CLI adapters, platform detection, and honest degradation reporting

Still planned:

- M6: marketplace validation, clean-install reproduction, release automation, and distribution checks

The specification remains the authority for intended behavior. Runtime claims are limited to behavior covered by code and CI.

## Authority model

Dokion does not decide which capability should run.

`dokion.json` is an inert catalog. It describes known skills, tools, plugins, loops, and policies. Catalog entries do not execute by being listed.

`.dokion/playbook.json` is the only execution authority. The user owns:

- capability selection
- execution order
- permissions
- approval policies
- retry and stop rules
- verification commands
- release gates

Dokion may validate, execute, journal, verify, explain gaps, and write inert recommendations. It may not autonomously select, install, substitute, reorder, upgrade, or enable a capability.

## Cross-agent model

The hardening workflow is authored once:

```text
skills/dokion-hardening/SKILL.md
```

Platform packages are thin adapters:

```text
Claude Code
  .claude-plugin/plugin.json
  .claude/skills/dokion/SKILL.md
  hooks/hooks.json
  scripts/claude-playbook-guard.ts

Codex
  AGENTS.md
  .codex/AGENTS.md
  .agents/skills/dokion-hardening/SKILL.md

Gemini CLI
  gemini-extension.json
  GEMINI.md
  commands/dokion/run.toml
  commands/dokion/status.toml
```

Adapters translate discovery, packaging, commands, context, and hooks. They do not create a second workflow and do not receive authority to alter the playbook.

## Platform guarantees and degradations

Dokion detects the active agent conservatively. `DOKION_AGENT` is the explicit authority. Unambiguous platform environment markers may be used when the explicit value is absent. Conflicting evidence becomes `other` rather than guessing.

A guarantee is recorded only when explicit evidence is available:

```text
DOKION_GUARANTEE_HOOK_ENFORCEMENT=1
DOKION_GUARANTEE_SUBAGENT_ISOLATION=1
DOKION_GUARANTEE_PARALLEL_WRITES=1
DOKION_GUARANTEE_WORKTREE_ISOLATION=1
```

Missing evidence is stored in `.dokion/state.json` and displayed in `HARDENING.md` as one or more degradations:

- `NO_HOOK_ENFORCEMENT`
- `NO_SUBAGENT_ISOLATION`
- `NO_PARALLEL_WRITES`
- `NO_WORKTREE_ISOLATION`

Dokion never treats differently capable agents as equivalent without evidence.

## Claude Code integrity guard

The Claude Code plugin registers a `PreToolUse` guard for Bash, Edit, Write, and NotebookEdit. During `RUNNING` or `AWAITING_USER`, it compares the current playbook digest with the digest stored in `.dokion/state.json`.

A mismatch blocks the tool call with `PLAYBOOK_TAINTED`. Terminal runs do not keep blocking the user's tools.

## Repair validation

Each remediation receives a repository snapshot captured immediately before the declared repair command.

The validator compares that snapshot with the post-repair tree and checks:

- tracked and untracked non-ignored files
- added, modified, and deleted paths
- edits outside the declared write scope
- newly added suppression directives
- deleted tests and added skip directives
- diff-size limits
- whether a required regression test was actually added or modified

A historical unchanged test does not satisfy `require_regression_test`.

When remediation, adversarial validation, or a verification command fails, Dokion restores the exact pre-remediation state for that finding. This preserves unrelated dirty work that existed before the repair and removes files created by the rejected repair.

Ignored untracked trees are not covered by the M4 snapshot. This boundary must remain visible as a runtime or platform limitation until a bounded ignored-file policy is implemented.

## Runtime layout

```text
HARDENING.md
.dokion/
  playbook.json
  state.json
  events.ndjson
  findings/
  evidence/
  reports/
  runs/
```

`HARDENING.md` is the human-readable report. `.dokion/state.json` is the machine state used for recovery and resume.

## CLI

```text
Observe
  dokion inspect
  dokion doctor
  dokion status
  dokion findings
  dokion report
  dokion tools list
  dokion skills list
  dokion plugins list
  dokion loops list

Configure
  dokion init
  dokion validate
  dokion validate --catalog-only

Execute
  dokion run
  dokion resume
  dokion verify
  dokion approve <step:id|finding:id> --by <identity> [--notes <text>]
  dokion reject <step:id|finding:id> --by <identity> [--notes <text>]
```

There is no `dokion install` command.

## Development setup

Requirements:

- Bun 1.3.14 or newer
- Python 3 with `jsonschema`
- Git

```bash
bun install --frozen-lockfile
python3 -m pip install jsonschema
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

## Minimal project flow

Initialize Dokion-owned state:

```bash
dokion init
```

Create `.dokion/playbook.json` yourself or copy and edit a reference playbook. Replace every placeholder digest with an immutable reference.

Validate before execution:

```bash
dokion validate
```

Run the approved playbook:

```bash
dokion run
```

When a step pauses for approval:

```bash
dokion approve finding:DK-APPSEC-001 --by mamdouh --notes "Approved scoped repair"
dokion resume
```

## Evidence rule

A step succeeds only when the declared command exits successfully and its output is stored as evidence.

A finding reaches `VERIFIED` only when:

1. the repair command completed
2. the repair delta passed adversarial validation
3. every declared verification command exited with code 0
4. required regression-test evidence exists

A suppression-based or incomplete repair becomes `REPAIR_REJECTED`. It never counts toward a readiness gate.

## Repository map

```text
src/
  approvals/       append-only approval decisions
  contracts/       JSON Schema validation
  engine/          ordered runtime and capability execution
  evidence/        command and repair artifacts
  findings/        normalization and persistence
  inspect/         project inspection
  platform/        agent detection, guarantees, and degradations
  playbook/        immutable playbook loading
  report/          HARDENING.md rendering
  state/           atomic state and event journal
  validation/      repair snapshots and adversarial checks

schemas/           manifest, playbook, state, finding, and lock schemas
playbooks/         inert examples and reference playbooks
skills/            canonical agent-neutral Dokion workflow
templates/         report and implementation contracts
tests/             seeded-defect and runtime acceptance tests
```

## Completion language

Dokion never emits an unqualified claim that a repository is production ready.

The valid completion statement is scoped to the user-configured gates, the tested commit, the stored evidence, platform degradations, and the limitations recorded in `HARDENING.md`.

## License

MIT. See [LICENSE](LICENSE).
