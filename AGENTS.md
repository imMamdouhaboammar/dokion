# Dokion Repository Instructions

Read `skills/dokion-hardening/SKILL.md` when the task involves Dokion execution, findings, remediation, verification, or reporting.

`.dokion/playbook.json is the only execution authority`. Do not edit it unless the user explicitly asks to author or change the playbook. Never select, install, substitute, reorder, upgrade, or enable capabilities on the user's behalf.

## Stack

- Runtime: Bun
- Language: TypeScript
- Contracts: JSON Schema
- State: `.dokion/state.json`
- Human report: `HARDENING.md`

## Required verification

Run the complete set before claiming a Dokion code change is ready:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

Use tests first for runtime behavior changes. Preserve immutable playbook checks, append-only evidence, exact repair rollback, and explicit approval records.

## Repository boundaries

- Runtime-owned paths: `.dokion/**` and `HARDENING.md`
- User-owned execution configuration: `.dokion/playbook.json`
- Catalog entries in `dokion.json` are inert
- Recommendations may be written only as inert suggestions
- Do not store credentials or private MCP configuration in the repository
