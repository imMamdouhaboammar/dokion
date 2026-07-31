---
name: agent-playbook
description: Orchestrates Agent-Playbook workflows, lifecycle hooks follow-ups, skill validation, PRD planning, and self-learning feedback loops in Dokion.
category: orchestration
hooks:
  - targetSkill: self-improving-agent
    mode: background
    reason: Capture session learning artifacts upon phase completion
  - targetSkill: code-reviewer
    mode: auto
    reason: Automated post-implementation quality review
---

# Agent-Playbook Orchestration Skill

The `agent-playbook` skill enables full end-to-end integration of the Agent Playbook ecosystem within Dokion.

## Features
- **Lifecycle Hook Follow-ups**: Automated evaluation and execution of `metadata.hooks` (`auto`, `background`, `ask_first`).
- **PRD Planning Pipeline**: Persistent file-based PRDs with pre-implementation prechecks.
- **Self-Improving Feedback Loop**: Automatic capture of session logs and proposal generation.
- **Skill Structure Validation**: Checks frontmatter, references, and bilingual documentation parity.

## Usage
Run via Dokion CLI:
```bash
dokion playbooks import --from /tmp/agent-playbook
dokion playbooks validate
dokion hooks run
```
