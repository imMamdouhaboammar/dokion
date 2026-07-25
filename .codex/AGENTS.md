# Dokion for Codex CLI

The repository operating contract is `AGENTS.md`.

## Canonical skill

- Source: `skills/dokion-hardening/SKILL.md`
- Codex discovery wrapper: `.agents/skills/dokion-hardening/SKILL.md`

The wrapper delegates to the canonical source. Do not create a second copy of the hardening workflow.

## Authority

`.dokion/playbook.json` is the only execution authority. Codex may run, resume, verify, journal, and report the declared workflow. It may not select, install, substitute, reorder, upgrade, or enable capabilities.

Keep credentials and private MCP configuration in user-level Codex settings, not in this repository.

## Verification

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```
