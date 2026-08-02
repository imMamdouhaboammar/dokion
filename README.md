# Dokion

> **The Playbook Engine for AI Coding Agents.**
>
> Connect single-task Skills into autonomous, multi-stage engineering pipelines with explicit user governance, empirical test verification, and automatic Git rollback.

[![Bun Baseline](https://img.shields.io/badge/bun-v1.3.14-black.svg?style=flat&logo=bun)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release Line](https://img.shields.io/badge/release-0.3.x-green.svg)](https://github.com/imMamdouhaboammar/dokion)

> Current release line: `0.3.x`
>
> Runtime baseline: M0-M6 implemented
>
> Audited runtime baseline: [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md)
>
> Production hardening backlog: in progress
>
> Compatibility matrix: [`docs/compatibility.md`](docs/compatibility.md)
>
> Federated Playbook Registry: protocol work in progress under [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47)

## Current truth boundary

The built-in runtime and user-authored Playbooks are available.

The replacement Registry is being built as a federated, content-addressed protocol under [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47).

---

## Why Dokion? (Skills Evolve into Playbooks)

AI coding agents (Claude Code, Gemini CLI, Cursor, Codex, AGY) are remarkably capable. However, left unsupervised in complex codebases, they encounter major reliability and safety challenges:

1. **Prompt Loops & Out-of-Scope Edits**: Agents lose context during long sessions, editing unrelated files or destroying repository structure.
2. **Hallucinated Verification**: Agents often claim *"Tests pass!"* without running them, or secretly delete failing test cases.
3. **Skill Fragmentation**: Single-task **Skills** work great for quick lookups, but fail when attempting multi-hour, multi-agent engineering workflows.

**Dokion solves this by introducing Playbooks.** A Playbook is a declarative, user-controlled execution contract that orchestrates skills, multi-agent swarms, verification gates, and rollback policies.

| Dimension | Single Skill | Dokion Playbook |
| :--- | :--- | :--- |
| **Workflow Scope** | Single task / one-off action | Multi-hour, multi-stage autonomous pipeline |
| **Agent Governance** | Freeform agent execution | Explicit write scopes, permission boundaries & release gates |
| **Verification** | Relies on agent self-reporting | Empirical verification (actual build & test execution logs) |
| **Repository Safety** | Manual git revert if agent breaks code | Automatic pre-repair snapshot & instant rollback |
| **Multi-Agent Swarms**| Single agent thread | Coordinates swarms of sub-agents with strict stage gates |

---

## Execution Lifecycle

```text
Inspect project & capabilities
    ↓
Validate active Playbook (.dokion/playbook.json)
    ↓
Render approved execution plan (`dokion plan`)
    ↓
Execute stage steps with bounded sub-agents (`dokion run`)
    ↓
Record empirical evidence & normalized findings
    ↓
Verify test/build proof (`dokion verify`)
    ↓
Accept clean result OR restore pre-repair Git snapshot
    ↓
Write immutable audit journal (HARDENING.md)
```

---

## Authority & Security Model

`dokion.json` is an inert catalog describing available skills, tools, and commands.

`.dokion/playbook.json` is the **sole execution authority**. The user explicitly controls:

- Capability & skill selection
- Execution order & stage sequence
- File write permissions & shell scopes
- Approval triggers (`BEFORE_WRITE`, `FIX_WITH_APPROVAL`, `NEVER`)
- Retry & timeout limits
- Mandatory verification commands & release gates

**Dokion Guaranteed Invariants**:
- Never installs undeclared capabilities automatically.
- Never expands write scope beyond declared permissions.
- Never silences or suppresses failing test findings.
- Never reports success without empirical verification evidence.

---

## Installation

Dokion is built natively on Bun for near-instant execution speed.

### Global Installation
```bash
bun add --global dokion
```

### Project-Local Installation
```bash
bun add --dev dokion
```

### System Requirements
- **Bun** `>= 1.3.14`
- **Git** (for snapshot creation, verification, and rollback)
- **Python** `3.13` (for optional JSON schema conformance checks)

---

## 🛡️ GitHub Actions Integration

Automate Dokion software hardening playbooks in your CI/CD pipeline using the official GitHub Action:

```yaml
# .github/workflows/dokion.yml
name: Dokion Hardening Check

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  dokion:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Dokion Hardening
        uses: imMamdouhaboammar/dokion@v0.3.0
        with:
          playbook: '.dokion/playbook.json'
          fail-on-findings: 'true'
          create-summary: 'true'
```

Key features in CI:
- **Zero-Setup Setup:** Installs Bun and Dokion CLI automatically.
- **Job Summary Reports:** Automatically appends `HARDENING.md` reports and evidence to GitHub CI Job Summaries.
- **Fail-Closed Gate:** Fails CI workflows if unverified mutations or unresolved findings are detected.

---

## Quickstart Workflow

### 1. Initialize Dokion State
```bash
dokion init
```

### 2. List & Select a Reference Playbook
```bash
dokion playbooks list
```

### 3. Preview the Execution Plan (Dry-Run)
Inspect the exact execution stages, capability steps, permissions, and gates without modifying files:
```bash
dokion plan
```

### 4. Execute the Playbook Engine
Execute the active playbook with explicit approval boundaries:
```bash
dokion run
# Or execute in bounded autopilot mode:
dokion autopilot
```

### 5. Inspect Status, Findings & Audit
```bash
dokion status
dokion findings
dokion report
```

---

## CLI Command Map

```text
Observe & Audit
  dokion status        View current run status, stage states, and approvals
  dokion findings      List normalized quality & security findings
  dokion report        Generate and write HARDENING.md
  dokion inspect       Inspect project files, frameworks, and capabilities
  dokion doctor        Verify system health, Bun runtime, and dependencies
  dokion audit         Audit repository compliance against active playbook
  dokion compare       Compare baseline and target execution runs

Configure & Plan
  dokion init          Initialize .dokion/ runtime directory and state
  dokion plan          Render detailed execution plan for active playbook
  dokion configure     Interactive environment configuration
  dokion validate      Validate playbook schema and repository contracts
  dokion create        Generate custom playbooks interactively
  dokion playbooks     Manage playbooks (list, import, validate)

Execute & Govern
  dokion run           Execute active playbook stages
  dokion autopilot     Run bounded hardening autopilot
  dokion step          Execute a single designated step
  dokion resume        Resume stopped execution from state journal
  dokion verify        Verify project state and test proof
  dokion approve       Record explicit approval for a stage/step
  dokion reject        Reject proposed step and trigger rollback
  dokion skip          Skip step with explicit reason
```

---

## Ecosystem & Agent Adapters

Dokion seamlessly integrates with your favorite AI coding environment:

- **Gemini CLI**: Included adapter via `gemini-extension.json` and `commands/dokion/`.
- **Claude Code**: First-class skill support in `.claude/skills/dokion`.
- **Cursor & AGY**: Pre-configured agent skill in `.agents/skills/dokion-hardening`.
- **CI/CD Integration**: Run `dokion verify` and `dokion audit` in GitHub Actions for automated PR release gating.

---

## Contributing

We welcome pull requests! Please ensure all contract checks pass before submitting:

```bash
bun install --frozen-lockfile
bun run validate:contracts
bun test
bun run typecheck
bun run build
bun run validate:distribution
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`SECURITY.md`](SECURITY.md) for details.

---

## License

MIT © [Mamdouh Aboammar](https://github.com/imMamdouhaboammar). See [`LICENSE`](LICENSE).
