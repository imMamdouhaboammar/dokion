# Dokion Launch & Community Marketing Playbook

This document contains copy-paste ready marketing copy, launch posts, social media threads, and community outreach strategies to drive viral adoption and developer awareness for Dokion.

---

## 1. Core Positioning Matrix

| Element | Specification |
| :--- | :--- |
| **Product Name** | Dokion |
| **Headline** | The Playbook Engine for AI Coding Agents |
| **Core Tagline** | Skills execute single tasks. Dokion Playbooks orchestrate autonomous multi-agent workflows. |
| **Primary Target Audience** | AI Developers, Vibe Coders, Senior Engineers using Claude Code, Gemini CLI, Cursor, or Codex |
| **Secondary Target Audience** | DevOps Leads, Open-Source Maintainers, Security Engineers |
| **Key Differentiator** | Empirical verification + Git snapshot auto-rollback + Multi-agent swarm governance |

---

## 2. Hacker News (Show HN) Launch Post

**Title**: Show HN: Dokion – The Playbook engine that stops AI coding agents from breaking production

**Post Body**:
```markdown
Hey HN! I'm Mamdouh, creator of Dokion (https://github.com/imMamdouhaboammar/dokion).

Over the past year, AI coding agents (Claude Code, Gemini CLI, Cursor, Codex) have completely transformed how we write software. But anyone who uses them heavily encounters the exact same pain points:
1. Agents get stuck in infinite prompt loops or edit files completely out of scope.
2. Agents claim "tests pass!" without actually running them or by secretly deleting broken assertions.
3. Single-purpose "Skills" work great for quick tasks, but fail when trying to run complex 3-hour engineering workflows.

We built Dokion to solve this. Dokion is an explicit, user-directed Playbook Engine for AI coding agents.

### How it works:
Instead of giving an AI agent unrestricted access to your repository, you define (or select) an immutable Playbook (`.dokion/playbook.json`).

1. **Governance & Scope**: You declare write scopes, permitted shell commands, approval boundaries, and sub-agent orchestration rules.
2. **Empirical Evidence**: Dokion requires real build/test execution logs. An agent cannot claim success just because its LLM response says "Done!".
3. **Auto-Rollback**: Before any remediation step, Dokion takes a clean Git snapshot. If verification commands fail or the agent produces tainted output, Dokion automatically restores the snapshot.
4. **Skills -> Playbooks**: Dokion connects individual skills (brainstorming, TDD, security scans, refactoring) into structured, multi-stage pipelines that can run autonomously for hours.

### Quick Start:
You can run our bundled reference workflow in seconds with Bun:

```bash
bun add --global dokion
dokion init
dokion plan
dokion run
```

Dokion is 100% open-source (MIT licensed) and written in Bun/TypeScript.

I'd love your feedback on the architecture, authority model, and how you currently manage AI agent safety in your codebase!

GitHub: https://github.com/imMamdouhaboammar/dokion
```

---

## 3. Twitter / X Viral Thread Blueprint

**Tweet 1 (Hook)**:
> 🧵 AI coding agents are incredible, but left unsupervised, they break tests, edit files out of scope, and hallucinate fixes.
>
> That's why we built Dokion: The Playbook Engine for AI Coding Agents.
>
> Here's how it keeps AI agents safe, verified, and bounded 👇
> [Attach 15-second terminal GIF showing Dokion auto-rollback]

**Tweet 2 (The Problem with Skills)**:
> Single-task "Skills" are everywhere, but they only handle 1 step. When you need an AI agent to run a 4-hour feature build or security audit across sub-agents, Skills fall short.
>
> Dokion introduces **Playbooks**: the natural evolution of Skills.

**Tweet 3 (The 4 Pillars)**:
> What Dokion does under the hood:
> 🛡️ **Explicit Write Scopes**: Constrain write scope & shell execution
> 🧪 **Empirical Proof**: Verifies actual test logs, blocks fake successes
> 🔄 **Git Snapshots**: Auto-rolls back rogue edits if verification fails
> 🤖 **Swarm Governance**: Coordinates parallel sub-agents safely

**Tweet 4 (CTA)**:
> 100% Open Source (MIT) built with Bun & TypeScript.
>
> Check out the repo & give it a star ⭐
> 🔗 https://github.com/imMamdouhaboammar/dokion

---

## 4. Reddit Posts (r/programming, r/LocalLLaMA, r/DevOps)

**Title**: Why we built a deterministic runtime to govern Claude Code, Gemini CLI & Cursor agents

**Subreddit Focus**:
- **r/LocalLLaMA**: Focus on autonomous agent swarms, local tool execution, and local Bun runtime.
- **r/DevOps**: Focus on PR release gates, verification proof, and CI/CD security controls.
- **r/programming**: Focus on architecture, execution contracts, and Git snapshot safety.

---

## 5. ProductHunt Launch Kit

- **Tagline**: The Playbook Engine for AI Coding Agents
- **Short Description**: Turn single-task skills into autonomous, verified, multi-agent workflows with automatic Git rollback and explicit governance.
- **Maker Comment Highlights**:
  - Why Skills aren't enough for long-running workflows.
  - How Dokion's pre-repair snapshot prevents repository corruption.
  - Integration with Bun, Gemini CLI, Claude Code, and Cursor.
