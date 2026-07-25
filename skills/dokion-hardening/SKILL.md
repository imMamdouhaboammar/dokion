---
name: dokion-hardening
description: Runs and resumes a user-authored Dokion hardening playbook, records findings and evidence, validates repairs, and reports scoped readiness. Use when a repository contains .dokion/playbook.json or the user asks to run, resume, inspect, validate, or report a Dokion hardening loop.
---

# Dokion Hardening

Use the Dokion CLI as the execution boundary. `.dokion/playbook.json` is the only execution authority.

Never select, install, substitute, reorder, upgrade, or enable a capability. Never edit `.dokion/playbook.json`. Recommendations are inert until the user changes the playbook.

## Start

1. Read `SPEC.md` when the task concerns Dokion internals.
2. Run `dokion doctor` and `dokion validate`.
3. If no active playbook exists, stop and explain that the user must create or copy one.
4. Run `dokion run` only after validation succeeds.

## Resume

1. Read `.dokion/state.json` and `HARDENING.md`.
2. Run `dokion status` and `dokion findings`.
3. If the run is waiting for approval, present the exact subject and scope.
4. After the user records a decision, run `dokion resume`.

## Approval commands

```bash
dokion approve finding:<id> --by <identity> --notes "<reason>"
dokion reject finding:<id> --by <identity> --notes "<reason>"
dokion approve step:<id> --by <identity> --notes "<reason>"
```

Do not infer approval from conversational tone when Dokion requires an approval record.

## Verification

A repair is accepted only when:

1. the declared remediation command exits successfully
2. the repair delta stays within the declared write scope
3. suppression and test-deletion checks pass
4. a required regression test was added or modified
5. every declared verification command exits with code 0

A failed or rejected repair must be restored to its pre-remediation snapshot. Treat `REPAIR_REJECTED`, `FAILED`, `BLOCKED`, and `TAINTED` as non-ready states.

## Development commands

Dokion itself uses Bun and TypeScript.

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run validate:contracts
bun run build
```

Do not replace Bun with npm, yarn, or pnpm in this repository.

## Completion language

Report only what the configured playbook proved for the recorded commit. Include active degradations, skipped lanes, manual checks, and uncovered areas. Never state that a repository is generally production ready from a partial Dokion run.
