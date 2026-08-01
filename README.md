<div align="center">

# ⚡ Dokion

### *Playbooks Engineering for AI Coding Agents*

**Enforce binding workflows. Orchestrate tools & skills. Eliminate agent drift.**

A user-directed Playbooks Engineering runtime for Claude Code, Codex, Gemini CLI, Cursor, Antigravity, and ordinary shell capabilities.

---

[![Paradigm: Playbooks Engineering](https://img.shields.io/badge/Paradigm-Playbooks%20Engineering-7C3AED.svg?style=for-the-badge&logo=codeforces&logoColor=white)](#-what-is-playbooks-engineering)
[![AI Agents: Supported](https://img.shields.io/badge/AI%20Agents-Claude%20Code%20%7C%20Codex%20%7C%20Gemini%20%7C%20Cursor%20%7C%20Antigravity-0969DA.svg?style=for-the-badge&logo=openai&logoColor=white)](#-cross-agent-architecture)
[![Playbooks: Current Paths](https://img.shields.io/badge/Playbooks-Core%20%7C%20Local%20Custom%20%7C%20Registry%20Planned-238636.svg?style=for-the-badge&logo=github&logoColor=white)](#-current-playbook-paths)

[![Agent Safety: Fail Closed](https://img.shields.io/badge/Agent%20Safety-Zero%20Drift%20%7C%20Fail%20Closed-D97706.svg?style=for-the-badge&logo=shield&logoColor=white)](#-authority-model)
[![Runtime: M0-M6 Implemented](https://img.shields.io/badge/Runtime-M0--M6%20Implemented-2EA44F.svg?style=for-the-badge)](docs/superpowers/plans/2026-07-25-m6-release-completion.md)
[![Bun Engine](https://img.shields.io/badge/Engine-Bun%201.3.14-000000.svg?style=for-the-badge&logo=bun&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-2563EB.svg?style=for-the-badge)](LICENSE)

---

</div>

<!-- project-story:start -->
<details open>
  <summary><strong>🚀 Executive Summary & Core Mission</strong></summary>
  <br />
  <p align="center"><img src="https://raw.githubusercontent.com/imMamdouhaboammar/imMamdouhaboammar/main/assets/profile/project-badges.svg" width="488" alt="Real friction, building in public, daily pulse" /></p>
  <table>
    <tr>
      <td width="104" align="center" valign="middle"><img src="./assets/readme/project-mark.svg" width="76" alt="Dokion repository mark" /></td>
      <td valign="middle"><strong>Dokion</strong><br />A Playbooks Engineering runtime that turns approved software engineering procedures into deterministic execution contracts for AI coding agents.</td>
    </tr>
  </table>
  <table>
    <tr>
      <td width="50%" valign="top"><strong>💥 The Problem: Agent Drift</strong><br />AI coding agents drift, skip critical validation steps, reorder checks, hallucinate claims, and generate low-quality code when given unconstrained prompts or loose guidelines.</td>
      <td width="50%" valign="top"><strong>✨ The Response: Playbooks Engineering</strong><br />Codify approved software procedures into immutable Playbooks that require step-by-step execution, evidence, verification, and rollback.</td>
    </tr>
    <tr>
      <td width="50%" valign="top"><strong>👥 Target Audience</strong><br />Developers and engineering teams using Claude Code, Codex, Gemini CLI, Cursor, Antigravity, and shell capabilities.</td>
      <td width="50%" valign="top"><strong>🔍 Keywords</strong><br />Playbooks Engineering · AI coding agent workflows · binding agent constitution · Local custom Playbooks · software hardening · evidence-based code repair</td>
    </tr>
  </table>
</details>
<!-- project-story:end -->

---

## 💡 What is Playbooks Engineering?

Whether you are experimenting with AI-assisted coding or operating a production engineering workflow, relying on ad-hoc prompts allows agents to skip checks and report conclusions without evidence.

> **Playbooks Engineering** is the discipline of turning human-approved software engineering procedures into binding, executable contracts for AI agents.

A **Dokion Playbook** is not an advice document or a passive prompt suggestion. It is a strict, sequential execution workflow that the runtime validates and executes without silently selecting, substituting, reordering, or expanding capabilities.

```text
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                              THE PLAYBOOK EXECUTION LOOP                               │
 └────────────────────────────────────────────────────────────────────────────────────────┘
                                              │
    1. Immutable Playbook           2. Step-by-Step Execution        3. Adversarial Validation
    ┌──────────────────────┐        ┌──────────────────────┐         ┌──────────────────────┐
    │ SHA-256 Digest Lock  │ ────►  │ Approved Agent Tasks │  ────►  │ Snapshot Comparison  │
    │ Binding Constitution │        │ Tool & Skill Chains  │         │ Regression Gate      │
    └──────────────────────┘        └──────────────────────┘         └──────────────────────┘
                                                                                 │
                                                                                 ▼
    5. Readiness Decision           4. Evidence Journaling            4b. Exact Rollback
    ┌──────────────────────┐        ┌──────────────────────┐         ┌──────────────────────┐
    │ Scoped Readiness     │ ◄────  │ Command Output Store │  ◄────  │ Pre-repair Snapshot  │
    │ Honest Degradation   │        │ Append-only Audit    │  (Fail) │ Restored Exactly     │
    └──────────────────────┘        └──────────────────────┘         └──────────────────────┘
```

---

## 🌌 Current Playbook Paths

Dokion currently supports approved built-in Playbooks and Local custom Playbooks. The federated Registry is planned but unavailable until the package, source, provenance, lockfile, installation, and publishing contracts are implemented.

<table>
  <thead>
    <tr>
      <th width="30%">Path</th>
      <th width="35%">Authority & Origin</th>
      <th width="35%">Current Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>🛡️ Built-in Playbooks</strong></td>
      <td>Tracked and maintained in this repository.</td>
      <td>Available when the referenced capabilities and verification commands are present.</td>
    </tr>
    <tr>
      <td><strong>⚙️ Local custom Playbooks</strong></td>
      <td>Authored and approved by the user or team for a specific project.</td>
      <td>Available through the current local validation and execution paths.</td>
    </tr>
    <tr>
      <td><strong>Registry rebuild</strong></td>
      <td>Federated, content-addressed sources with immutable package verification.</td>
      <td>Unavailable. Track design and delivery in <a href="https://github.com/imMamdouhaboammar/dokion/issues/47">issues/47</a>.</td>
    </tr>
  </tbody>
</table>

The future Registry will keep discovery, pull, install, and activation as separate transitions. Registry metadata will never grant execution authority, and the public Store will read a validated static snapshot rather than becoming the package authority.

---

## 🎯 Macro-to-Micro Engineering Spectrum

Dokion Playbooks can describe broad engineering programs or narrowly scoped checks. Actual support depends on the capabilities declared in the active Playbook and available in the environment.

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3>🏛️ Macro Engineering Domains</h3>
      <ul>
        <li><strong>UI/UX systems</strong>: accessibility, design tokens, component behavior, and responsive layouts.</li>
        <li><strong>Application security</strong>: dependency checks, secret scanning, SAST, and release gates when the required scanners are installed.</li>
        <li><strong>Backend architecture</strong>: API contracts, migrations, database boundaries, and service behavior.</li>
        <li><strong>Testing and performance</strong>: unit, integration, browser, regression, and benchmark workflows.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🔬 Focused Tasks</h3>
      <ul>
        <li><strong>Code cleanup</strong>: dead code, placeholder fallbacks, redundant comments, and unused imports.</li>
        <li><strong>Git and release protocols</strong>: commit rules, branch isolation, artifact checks, and changelog verification.</li>
        <li><strong>Targeted repair loops</strong>: one finding, one bounded change, and explicit re-verification.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🧰 Multi-Skill & Multi-Tool Orchestration

A Dokion Playbook can coordinate different capabilities while keeping selection and authority with the user:

* **Declared capability execution**: only capabilities named in the active Playbook may run.
* **Heterogeneous tool chaining**: static analyzers, tests, git checks, security scanners, and agent adapters can participate when explicitly configured.
* **Approval boundaries**: installation, writes, fixes, and commits follow the Playbook approval policy.
* **Fail-closed behavior**: missing executors, unsupported output formats, failed verification, or incomplete rollback stop the run.

---

## 🧠 Playbook Creator & Memory Inputs

Dokion includes Playbook creation components that can synthesize a local proposal from selected memory or transcript inputs. Generated commands remain constrained, require explicit approval, and do not gain authority until the resulting Playbook is validated and approved.

```text
  ┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
  │  Selected Memory Input │      │   Pattern Synthesis    │      │   Local Playbook       │
  │  or Transcript         │ ──►  │   Rules and Checks     │ ──►  │ .dokion/playbook.json │
  │  User-provided Scope   │      │   Bounded Commands     │      │ Validated and Approved │
  └────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## ⚡ Current Status & Runtime Milestones

Runtime baseline: M0-M6 implemented.

Production hardening backlog: in progress.

Dokion is built with **Bun** as an executable CLI featuring cross-agent adapters, snapshot-based repair validation, clean-install reproduction, package verification, and a protected Bun-only release pipeline. The audited baseline is recorded in [`docs/architecture/current-baseline.md`](docs/architecture/current-baseline.md), and support claims are detailed in the [support and compatibility matrix](docs/compatibility.md).

* **M0**: JSON Schemas, conformance contracts, and CI validation gates.
* **M1**: Immutable Playbook loading and SHA-256 mutation detection.
* **M2**: Sequential execution engine, state journaling, evidence capture, and resume.
* **M3**: Normalized findings, append-only approval records, and verification gates.
* **M4**: Snapshot-based adversarial repair validation, readiness gates, and exact rollback.
* **M5**: Canonical hardening skill and agent adapters.
* **M6**: Embedded runtime assets, distribution inspection, clean Bun installation smoke tests, and cross-platform binaries.

---

## 🔒 Authority Model

Dokion does **not** decide autonomously which capability runs.

* `dokion.json` is an **inert catalog**. It lists available skills, tools, plugins, and policies. Listing an entry does not execute it.
* `.dokion/playbook.json` is the **sole execution authority**. The human developer retains ownership over:
  * capability selection and execution order
  * permissions and approval policies
  * retry, timeout, and stop rules
  * verification commands and release gates

Dokion validates, executes, journals evidence, and verifies repairs. It never autonomously selects, installs, substitutes, or reorders steps.

---

## 🌐 Cross-Agent Architecture

Write the canonical Playbook once and expose it through thin adapters:

```text
Canonical Playbook & Skill Representation
  └── skills/dokion-hardening/SKILL.md

Thin Agent Adapters
  ├── Claude Code      ───► .claude-plugin/plugin.json & scripts/claude-playbook-guard.ts
  ├── Codex            ───► AGENTS.md & .codex/AGENTS.md
  ├── Gemini CLI       ───► gemini-extension.json & commands/dokion/run.toml
  ├── Cursor           ───► .cursor/rules/
  └── Antigravity      ───► .gemini/config/skills/
```

Adapters translate discovery, commands, context, and hooks. They do not alter Playbook logic or grant authority.

---

## 🛡️ Snapshot Repair Validation & Exact Rollback

When a repair step runs, Dokion applies the declared worktree policy and evidence rules:

1. **Pre-repair baseline**: the relevant repository state is captured before the repair.
2. **Adversarial inspection**: changed paths, scope, suppressions, tests, and declared success conditions are checked.
3. **Verification**: the configured verification commands must pass after the change.
4. **Rollback**: rejected repairs restore the prior verified state while preserving unrelated user work according to policy.

---

## 💻 CLI Command Reference

The canonical command registry generates help and manifest metadata. Run:

```bash
dokion --help
```

Common implemented commands include:

```text
Observe
  dokion inspect
  dokion doctor
  dokion status
  dokion findings
  dokion report

Configure
  dokion init
  dokion plan
  dokion configure
  dokion validate
  dokion playbooks <import|validate|sync|list>

Execute
  dokion run
  dokion step <step-id>
  dokion resume
  dokion verify
  dokion approve <subject> --by <identity>
  dokion reject <subject> --by <identity>
```

`dokion hub` is planned and currently returns `CLI_PLANNED_COMMAND`. It is not shown in generated help until the federated Registry works end to end.

---

## 🚀 Quick Start Guide

### 1. Installation

Global installation via **Bun**:

```bash
bun add --global dokion
```

Or repository-local development dependency:

```bash
bun add --dev dokion
```

### 2. Minimal Project Workflow

```bash
dokion init
dokion validate
dokion plan
dokion run
```

Create, review, and approve `.dokion/playbook.json` before execution. Installation of a package or capability does not itself grant execution authority.

---

## 🛠️ Local Development & Testing

Requirements: **Bun 1.3.14+**, Python 3 with `jsonschema`, Git, and system `tar`.

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run validate:contracts
bun run build
bun run validate:distribution
bun run smoke:package
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
