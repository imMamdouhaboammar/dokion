# Dokion Gemini CLI Context

Read `skills/dokion-hardening/SKILL.md` before running, resuming, validating, or changing Dokion workflows.

`.dokion/playbook.json` is the only execution authority. Do not select, install, substitute, reorder, upgrade, or enable a capability. Do not edit the active playbook during a run.

Use the namespaced commands:

- `/dokion:run` validates and starts the user-authored playbook
- `/dokion:status` reports run state, findings, evidence, and platform degradations
- `/dokion:goal` manages run-until-done objectives, verifiers, and progress telemetry

Dokion uses Bun and TypeScript. For repository changes, run:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

A completion statement must be limited to the configured gates, recorded commit, stored evidence, skipped lanes, and active degradations.
