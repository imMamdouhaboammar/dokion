# Playbook Authoring Reference Guide

This reference guide details how to construct valid Dokion playbooks adhering to `schemas/dokion-playbook.schema.json`.

## Schema Structure
A Dokion playbook consists of:
- `id`: Unique string identifier (e.g. `web-fullstack-v1`).
- `name`: Human-readable name.
- `steps`: Array of step objects with deterministic dependency ordering.

```json
{
  "id": "custom-hardening-v1",
  "name": "Custom Software Hardening Playbook",
  "steps": [
    {
      "id": "lint",
      "command": "bun run lint",
      "type": "VERIFY",
      "approvalPolicy": "NEVER"
    },
    {
      "id": "test",
      "command": "bun test",
      "type": "GATE",
      "dependsOn": ["lint"],
      "approvalPolicy": "ALWAYS"
    }
  ]
}
```

## Approval Policies
- `NEVER`: Read-only step; executes automatically without prompting.
- `BEFORE_WRITE`: Prompts for approval before writing changes to disk.
- `ALWAYS`: Prompts for explicit user approval before execution.
