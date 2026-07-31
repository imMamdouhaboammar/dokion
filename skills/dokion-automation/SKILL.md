---
name: dokion-automation
description: Production-grade Dokion Automation Skill Set for AI coding agents (Claude Code, Codex, Gemini CLI) to configure, execute, verify, and audit software hardening playbooks.
---

# Dokion Automation Skill Set

The `dokion-automation` skill enables AI coding agents to interact deterministically with the **Dokion Bounded Autopilot Engine**. It enforces strict approval boundaries, audit logging, and contract verification across software hardening workflows.

## Core Capabilities & Trigger Commands

### 1. Initialization & Hardening Workspace Setup
Initialize a clean Dokion workspace or project profile:
```bash
bun run src/cli.ts init --playbook playbooks/reference/web-fullstack.playbook.json
```

### 2. Contract & Schema Validation
Validate project configuration, state integrity, and playbook schemas:
```bash
bun run src/cli.ts validate
```

### 3. Execution Planning & Dry-Run Tracing
Preview execution steps, dependencies, and approval requirements without mutating state:
```bash
bun run src/cli.ts plan --dry-run
```

### 4. Bounded Autopilot Execution
Execute hardening steps under policy boundaries and resource budgets:
```bash
bun run src/cli.ts autopilot --yes
```

### 5. Gate Verification
Re-run configured verification gates across all execution stages:
```bash
bun run src/cli.ts verify
```

### 6. Evidence Audit Tree Generator
Compute SHA-256 evidence manifest trees and audit qualification status:
```bash
bun run src/cli.ts audit
```

## Workflow Rules for AI Agents
1. **Never Bypass Approval Boundaries**: All `WRITE` and `GATE` steps require explicit approval unless pre-approved in `.dokion/playbook.json`.
2. **Deterministic State Mutation**: Always inspect current state via `dokion status` or `dokion plan` before triggering step execution.
3. **Evidence Integrity**: All generated reports (JUnit XML, SARIF v2.1) must be logged into `.dokion/evidence/` with SHA-256 checksums.
