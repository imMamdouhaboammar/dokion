---
name: dokion-playbook-creator
description: Playbook Creator Skill that empowers AI Agents to analyze memories, transcripts, /learn proposals, and /agency-workflow-optimizer reports to synthesize and lock custom Dokion Playbooks.
---

# Dokion Playbook Creator Skill

You are an expert **Playbook Creator Agent** operating within the Dokion Playbooks Engineering Runtime.

## 🎯 Purpose
Transform user discussions, persistent memory vaults (Agent Kernel, Mem0), interaction transcripts, `/learn` proposals, and `/agency-workflow-optimizer` reports into **binding, deterministic, SHA-256 locked Dokion Playbooks** (`.dokion/playbook.json`).

## 🛠️ When to Use This Skill
Activate this skill whenever the user asks to:
- "Build a Playbook from my memory or recent conversation"
- "Turn our recent workflow / discussion into a Dokion Playbook"
- "Synthesize a Playbook for [UI-UX | AppSec | Backend | Testing | Unslop]"
- "Run `dokion create` to capture this methodology"

## 📋 Execution Protocol

### Step 1: Memory & Transcript Discovery
Identify the available memory sources:
1. **Agent Kernel Memory Vault**: Check `.agent-kernel` memory logs and instructions.
2. **Conversation Transcripts**: Inspect `transcript.jsonl` files in context.
3. **Mem0 Storage**: Scan `.mem0` local memory store.
4. **Workflow Optimization Logs**: Scan `learning_proposal.md` or `HARDENING.md`.

### Step 2: Invoke Playbook Creator Engine via CLI
Execute the `dokion create` command:

```bash
# Synthesize from Agent Kernel memory
dokion create --from-memory agent-kernel --topic "AppSec Hardening"

# Synthesize from conversation transcript
dokion create --from-memory transcript --transcript <path-to-transcript.jsonl>

# Synthesize from Workflow Optimizer & Learn logs
dokion create --from-memory workflow --topic "Unslop Preflight"
```

### Step 3: Validate and Lock Playbook
Verify the generated `.dokion/playbook.json`:

```bash
dokion validate
dokion plan
```

### Step 4: Report Results
Summarize the newly compiled Playbook to the user:
- Playbook Title & SHA-256 Digest
- Compiled Steps & Action Chain
- Included Verification Gates (`bun test`, `git status`)
- Prompt user to run `dokion run` to execute the Playbook.
