# Dokion Growth & Rebranding Strategy: "From Skills to Playbooks"

## Executive Overview

Dokion is an explicit, user-directed runtime for orchestrating and executing software hardening and engineering **Playbooks** across AI coding agents (Claude Code, Gemini CLI, Cursor, Codex) and local developer tools.

Despite having a rock-solid, production-tested runtime baseline (M0-M6), deterministic execution engine, git snapshot/rollback system, and multi-agent governance model, Dokion currently suffers from **low adoption and market traction**.

### Primary Cause of Traction Deficit
1. **Misleading Marketing & Jargon Overload**: Previous branding framed Dokion purely as a *"software hardening runtime"*, causing developers to mistake it for a niche security/compliance tool rather than a general-purpose **AI Agent Workflow Orchestrator**.
2. **Hidden Value Proposition**: AI developers and Vibe Coders use **Skills** daily, but single-task skills fail when attempting multi-hour, multi-step, multi-agent workflows. Dokion solves this by evolving Skills into **Playbooks**, but this core value proposition was buried under enterprise specification jargon.
3. **Onboarding Friction**: High initial setup barrier (`.dokion/playbook.json` manual schema writing) compared to zero-config one-liners.
4. **Lack of Visual Content & Social Proof**: No interactive visual demos, animated terminal walkthroughs, or public launch materials demonstrating Dokion's automatic rollback & verification in action.

---

## The New Strategic Positioning: "Skills Evolve into Playbooks"

### Core Tagline
> **"Skills execute single tasks. Dokion Playbooks orchestrate autonomous multi-agent workflows."**

### Hero Pitch (30-Second Elevator Pitch)
"AI coding agents are powerful, but left unsupervised, they break tests, introduce silent vulnerabilities, or loop endlessly. Dokion is the Playbook Engine for AI coding agents. It connects single-purpose skills into structured, multi-hour engineering pipelines—governing permissions, launching swarms of sub-agents, verifying empirical test proof, and automatically rolling back rogue edits before they hit main."

---

## 5-Pillar Action Plan

```mermaid
graph TD
    A[Dokion Growth Engine] --> B[Pillar 1: Narrative & Brand Pivot]
    A --> C[Pillar 2: DX & Zero-Friction Onboarding]
    A --> D[Pillar 3: Distribution & Virality]
    A --> E[Pillar 4: Marketing & Content Launch]
    A --> F[Pillar 5: Federated Playbook Registry]

    B --> B1["Positioning: Skills -> Playbooks"]
    B --> B2["Updated README & Landing Page"]

    C --> C1["Zero-Config `dokion run`"]
    C --> C2["Interactive `dokion create` CLI Wizard"]

    D --> D1["GitHub Action (`dokion-action`)"]
    D --> D2["Gemini CLI / Claude Code / Cursor Adapters"]
    D --> D3["Terminal SVG/GIF Demos"]

    E --> E1["Hacker News / Reddit Showcases"]
    E --> E2["ProductHunt Launch Kit"]

    F --> F1["Content-Addressed Registry Protocol (Issue #47)"]
    F --> F2["`dokion install` Community Ecosystem"]
```

---

## Detailed Specifications per Pillar

### Pillar 1: Rebranding & Messaging Overhaul
- **File Targets**: `README.md`, `docs/index.html`, `docs/getting-started/ONBOARDING.md`.
- **Key Changes**:
  - Replace *"user-directed software hardening runtime"* with *"The Playbook Engine for AI Coding Agents"*.
  - Add an explicit **"Why Playbooks over Skills?"** comparison table:
    | Feature | Single Skill | Dokion Playbook |
    | :--- | :--- | :--- |
    | **Scope** | Single task / one-off action | Multi-hour, multi-stage engineering pipeline |
    | **Agent Governance** | Freeform agent execution | Explicit write scopes, permission boundaries & release gates |
    | **Verification** | Relies on agent self-reporting | Empirical verification (tests/builds must pass) |
    | **Safety** | Manual git revert if agent breaks code | Automatic pre-repair snapshot & instant rollback |
    | **Orchestration** | Single agent thread | Coordinates swarms of sub-agents concurrently |

---

### Pillar 2: Developer Experience (DX) & Zero-Friction Onboarding
- **Zero-Config Execution**:
  Make `dokion run` automatically fall back to bundled reference playbooks (e.g. `superpowers`, `web-fullstack`, `security-audit`) if no local `.dokion/playbook.json` exists.
- **Interactive CLI Generator**:
  Enhance `dokion create` / `dokion init` to walk the user through 3 simple prompts to generate a tailored Playbook in under 10 seconds.
- **Terminal Polish**:
  Ensure colored CLI output, visual progress indicators during stage execution, and crisp summary tables for `dokion status` and `dokion findings`.

---

### Pillar 3: Distribution, Viral Growth & Ecosystem Integrations
- **GitHub Action Packaging**:
  Document and package Dokion as a reusable GitHub Action (`dokion-action`), allowing team leads and open-source maintainers to enforce Playbooks on every Pull Request.
- **AI Agent Native Integrations**:
  Promote built-in adapters for:
  - **Gemini CLI Extension**: `gemini-extension.json` + `commands/dokion/`
  - **Claude Code Skill**: `.claude/skills/dokion` + `.claude-plugin`
  - **AGY / Cursor Skills**: `.agents/skills/dokion-hardening`
- **Visual Terminal Demos**:
  Embed interactive SVG/GIF animations showing Dokion stopping an AI agent from committing broken code and reverting changes cleanly.

---

### Pillar 4: Marketing Launch Kit & Community Content
- **Hacker News (Show HN)**:
  *Title*: "Show HN: Dokion – The Playbook engine that stops AI coding agents from breaking production"
  *Content*: The engineering story behind building a deterministic runtime with snapshot rollback and empirical verification.
- **Reddit (r/programming, r/LocalLLaMA, r/DevOps)**:
  Deep-dive technical post explaining why agentic coding needs execution contracts rather than raw prompt loops.
- **ProductHunt Launch**:
  Prepared gallery cards, tagline, maker comment, and demo video script.

---

### Pillar 5: Federated Registry Ecosystem
- Advance [Issue #47](https://github.com/imMamdouhaboammar/dokion/issues/47) to allow developers to publish, search, and install verified Playbooks using `dokion playbooks search` and `dokion playbooks pull`.

---

## Verification & Conformance Strategy
- All README and doc changes will be audited using the `docs-guard` skill rules:
  1. Every referenced CLI command, sub-command, flag, and JSON key must match actual implementation in `src/cli.ts` and `schemas/`.
  2. Every code snippet must be runnable with Bun.
  3. No unverifiable performance or scale claims.
