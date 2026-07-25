<div align="center">

# Dokion

### *Your rules. Your tools. Proven software.*

Cross-agent security & quality hardening engine for **Claude Code**, **Codex**, and **Gemini CLI**.

[![Specification: v1.0.0--draft](https://img.shields.io/badge/Specification-v1.0.0--draft-0052CC.svg?style=flat-square)](SPEC.md)
[![Conformance: 100% Passed](https://img.shields.io/badge/Conformance-100%25%20Passed-2EA44F.svg?style=flat-square&logo=python&logoColor=white)](schemas/conformance_test.py)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/imMamdouhaboammar/dokion/pulls)
[![GitHub Stars](https://img.shields.io/github/stars/imMamdouhaboammar/dokion?style=flat-square&logo=github)](https://github.com/imMamdouhaboammar/dokion/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/imMamdouhaboammar/dokion?style=flat-square&logo=github)](https://github.com/imMamdouhaboammar/dokion/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/imMamdouhaboammar/dokion?style=flat-square&color=blue)](https://github.com/imMamdouhaboammar/dokion/issues)

[Overview](#-the-problem) • [Four Mechanisms](#-four-mechanisms) • [Security & Authority Model](#-why-the-authority-model-is-the-security-model) • [Architecture](#-the-two-file-split) • [Conformance](#-enforced-authority-model-conformance-testing) • [Quick Start](#-getting-started-once-implemented) • [Agent Compatibility](#-cross-agent-support-matrix)

</div>

---

> [!NOTE]
> **Status: Spec-Stage Repository.** This repository defines the Dokion specification, JSON Schemas, authority model, and reference playbooks.
> - [`SPEC.md`](SPEC.md) — Complete specification document.
> - [`dokion.json`](dokion.json) — Identity & procedures manifest (catalog).
> - [`templates/BUILD_PROMPT.md`](templates/BUILD_PROMPT.md) — Self-contained master prompt to implement Dokion with any coding agent.

---

## 🎯 The Problem

Ask a coding agent to *"harden this project"* and the failure mode is predictable. It audits broadly, fixes shallowly, silences whatever still complains, and reports success. Nothing in that loop distinguishes a repaired vulnerability from a suppressed warning. And nothing survives the context window — thirty steps of tool output later, the agent no longer remembers what it checked.

**Dokion solves this by introducing deterministic, user-authored playbooks and verifiable evidence gates.**

---

## ⚡ Four Mechanisms

| Mechanism | Description |
| :--- | :--- |
| **1. You Own Process** | `.dokion/playbook.json` is authored by you and is the **only file that authorizes execution**. Dokion may validate, verify, explain gaps, or *recommend* changes — but **never** selects, installs, substitutes, reorders, or enables capabilities on its own. Recommendations land in `.dokion/playbook.proposed.json` and change nothing until you accept them. |
| **2. The File is the State** | `HARDENING.md` and `.dokion/state.json` are written before they are needed. Agent context is expendable; disk state is persistent. Kill the session mid-run and any agent, on any model, resumes from disk with zero context loss. |
| **3. No Unverified Success** | A step advances only when a verification command exits `0` and its output is captured as cryptographic evidence. Never on an agent assertion alone. Adding `# nosec` over a defect routes to `REPAIR_REJECTED`, not `VERIFIED`. |
| **4. Uncovered Means Uncovered** | Dokion tracks capability *lanes* (appsec, API contracts, DB hardening, observability, supply chain). A lane without assigned capabilities caps readiness at `CONDITIONALLY_READY` until you assign a capability or acknowledge the gap by name. A hole in the audit is reported as a hole, not rounded up to a pass. |

---

## 🔒 Why the Authority Model is the Security Model

Snyk's [ToxicSkills study](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) found prompt injection in **36% of tested agent skills** and 1,467 malicious payloads. The barrier to publishing a malicious skill is just a `SKILL.md` and a week-old GitHub account.

- **Self-selecting orchestrator:** Must be trusted about what it picked.
- **Dokion model:** Only executes a user-authored list, making it **fully auditable**. You diff the playbook, and the final report reconciles against it.

That is why `.dokion/capabilities.lock.json` has **zero** selection, substitution, or installation authority: it strictly verifies what you already approved.

---

## 📐 The Two-File Split

```
                              ┌─────────────────────────────────────────┐
                              │               dokion.json               │
                              │           (Ships with Dokion)           │
                              │                                         │
                              │ Catalog of identity, known capabilities, │
                              │ loop templates, & policies. INERT.      │
                              └────────────────────┬────────────────────┘
                                                   │
                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 .dokion/playbook.json                                  │
│                                  (Authored by YOU)                                     │
│                                                                                        │
│ Explicit list of approved capabilities, execution order, permissions, & approval gates.│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

| File | Owner | Role & Function |
| :--- | :--- | :--- |
| [`dokion.json`](dokion.json) | Ships with Dokion | **Catalog.** Identity, known capabilities, loop templates, policies, coverage gaps. Nothing in it executes by default (`default_enabled: false`, `requires_user_approval: true`). |
| `.dokion/playbook.json` | **User (You)** | **Authorization.** The specific capabilities you approved, in the order you selected, with explicit permissions granted. |

---

## 📂 Repository Structure

```gss
.
├── dokion.json                              # Identity + procedures manifest (the catalog)
├── SPEC.md                                  # Complete Dokion system specification
├── schemas/                                 # Rigid JSON Schemas enforcing authority & state
│   ├── dokion-manifest.schema.json          # Validates dokion.json
│   ├── dokion-playbook.schema.json          # Validates .dokion/playbook.json
│   ├── dokion-state.schema.json             # Validates .dokion/state.json
│   ├── dokion-finding.schema.json           # Normalized finding envelope
│   ├── capability-lock.schema.json          # Validates .dokion/capabilities.lock.json
│   └── conformance_test.py                  # Pytest suite proving schema enforcement
├── playbooks/                               # Reference & example playbooks
│   ├── example.playbook.json                # Minimal three-stage playbook
│   └── reference/                           # Domain libraries (inert until copied & edited)
│       ├── web-fullstack.playbook.json      # Full-stack web application playbook
│       ├── api-service.playbook.json        # API service hardening playbook
│       └── library-package.playbook.json    # Open-source library playbook
└── templates/                               # Output & prompt templates
    ├── HARDENING.template.md                # Markdown readiness report template
    └── BUILD_PROMPT.md                      # Master prompt to implement Dokion engine
```

---

## 🧪 Enforced Authority Model (Conformance Testing)

A specification that only *describes* its security guarantees is a wish. Dokion encodes these guarantees into JSON Schemas, making non-compliant behavior **unrepresentable**:

```bash
# Install validator & run strict schema conformance suite
pip install jsonschema && python3 schemas/conformance_test.py
```

### The Negative Suite Asserts Schema Rejection
The test runner verifies that schemas **refuse**:
- Playbooks granting `automatic_installation`, `automatic_substitution`, or `automatic_reordering`.
- Playbooks delegating capability selection or execution order to the orchestrator.
- Manifests dropping `"reorder steps"` or `"install undeclared capability"` from `forbidden_autonomy`.
- Catalog entries shipping `default_enabled: true` or waiving user approval.
- Capabilities pinned to floating references (`latest`).
- Findings marked `VERIFIED` without evidence.
- Risk acceptances or deferrals without user attribution.

---

## 🛡️ Runtime Layout

When running in a project, Dokion creates and maintains the following directory structure:

```
├── HARDENING.md                         # Auditable markdown report
└── .dokion/                             # Machine state directory
    ├── playbook.json                    # User authorization (write-blocked, SHA-256 pinned)
    ├── playbook.proposed.json           # The only playbook file Dokion may generate
    ├── state.json                       # Machine state & step progress tracker
    ├── capabilities.lock.json           # Resolved capability digests & installer rules
    ├── events.ndjson                    # Append-only execution event log
    └── findings/ evidence/ reports/ runs/ # Artifact storage
```

---

## 🚀 Getting Started *(Once Implemented)*

Dokion never invents a playbook without explicit approval.

### 1. Initialize & Generate Proposal

```bash
dokion init          # Initialize .dokion state & HARDENING.md (installs nothing)
dokion inspect       # Detect project stack (proposes no execution)
dokion plan          # Write .dokion/playbook.proposed.json and stop
```

### 2. Review & Activate

Review and edit the proposed playbook, then activate it:

```bash
cp .dokion/playbook.proposed.json .dokion/playbook.json
dokion validate      # Verify schema & validate declared capabilities
dokion run           # Execute hardening stages, gated by approval policies
```

### 3. Or Adopt a Reference Playbook

```bash
mkdir -p .dokion
cp playbooks/reference/web-fullstack.playbook.json .dokion/playbook.json

# Edit .dokion/playbook.json:
# 1. Replace sha256:PLACEHOLDER with real hashes
# 2. Configure project-specific test & lint commands
# 3. Prune steps you do not want to run
```

---

## 🤖 Cross-Agent Support Matrix

Dokion provides unified hardening across leading AI agent runtimes:

| Capability / Guarantee | Claude Code | Codex | Gemini CLI |
| :--- | :---: | :---: | :---: |
| **Playbook Authority & Schema Validation** | ✅ | ✅ | ✅ |
| **SHA-256 Digest Pinning** | ✅ | ✅ | ✅ |
| **Evidence Gates & State Recovery** | ✅ | ✅ | ✅ |
| **Hook-Based Write Prevention** | ✅ | ⚠️ Detection only | ⚠️ Detection only |
| **Subagent Scope Isolation** | ✅ | ⚠️ Detection only | ⚠️ Detection only |
| **Parallel Isolated Writers** | ✅ | — | — |

*Where a platform guarantee is missing or partial, the run log records it and `HARDENING.md` explicitly flags the limitation.*

---

## 🔗 Related & Ecosystem

- **[Superpowers](https://github.com/obra/superpowers)** — Governs how you *build new code*. Dokion governs how you *prove existing code*. They compose seamlessly — Dokion's catalog lists Superpowers as a capability: pinned, verified, scoped, and off until you approve it.

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

