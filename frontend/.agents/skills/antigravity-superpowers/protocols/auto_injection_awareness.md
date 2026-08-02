# ⚡ Protocol 13: Mandatory Auto-Injection, Usage & Awareness Protocol

## 1. Overview
This protocol establishes binding system mechanics for **Antigravity** to ensure that all 88+ specialized division skills (`engineering-*`, `security-*`, `testing-*`, `design-*`), background subagents, MCP tools, and protocol workflows are **automatically detected, auto-injected, and utilized** on every user prompt without requiring manual user invocation.

## 2. Core Operational Mechanics

### A. Pre-Flight Auto-Discovery (Zero-Prompt Awareness)
- On every prompt, Antigravity immediately executes a zero-latency registry scan across:
  1. `~/.gemini/config/skills/` (Global System Base Directory containing 88+ skills)
  2. `.agents/skills/` (Project-specific skills)
  3. Registered MCP Servers & Tools (`gsd_*`, `chrome-devtools`, `data-agent-kit`, `firebase`, etc.)
- **No manual user prompt or slash command is required** to activate any skill or tool.

### B. Auto-Injection Matrix (Dynamic Task Mapping)
- The user request is automatically evaluated against the 4 Division Routers:
  - **Engineering Division (57 roles)**: Code architecture, backend APIs, frontend, databases, mobile, AI/ML, RAG, etc.
  - **Security Division (12 roles)**: AppSec, cloud security, audit, penetration testing, secrets protection.
  - **Testing Division (9 roles)**: E2E test automation, performance benchmarking, accessibility, reality checks.
  - **Design Division (10 roles)**: UI/UX design, typography, brand guidelines, visual finish gate, whimsy.
- Matching skills and tools are **automatically injected into the active execution context**.

### C. Automatic Execution & Subagent Dispatch
- When a task spans multiple domains, Antigravity automatically dispatches parallel subagents via `invoke_subagent` with the pre-injected specialized role instructions.
- Subagents execute with inherited full-awareness of all system capabilities and report back with empirical proof.

### D. Evidence-Based Verification & Unslop Gate
- Every task completed via auto-injected skills must pass verification before claiming completion:
  - Green test pass output (`bun test`, `vitest`).
  - Typecheck validation (`bun x tsc --noEmit`).
  - Zero secrets or credential exposure.
