---
name: dokion-automation
description: Configures, runs, verifies, and audits Dokion hardening playbooks end to end. Use when the user asks to set up Dokion in a repository, drive the bounded autopilot loop, execute a hardening playbook from `.dokion/playbook.json`, validate repairs, audit evidence, or recover from a failed or blocked Dokion run. Works with Claude Code, Codex, and Gemini CLI adapters.
---

# Dokion Automation

Use the Dokion CLI as the only execution boundary. `.dokion/playbook.json` is the sole execution authority.

Never select, install, substitute, reorder, or enable a capability. Never upgrade a capability. Never edit `.dokion/playbook.json` unless the user has explicitly asked in writing. Recommendations from `dokion validate`, `dokion plan`, `dokion findings`, and `dokion audit` are inert until the user changes the playbook.

## Operating rules

1. Treat `.dokion/**` and `HARDENING.md` as runtime-owned. Do not hand-edit them.
2. Every persistent decision (approve, reject, skip) is recorded through the CLI (`dokion approve`, `dokion reject`, `dokion skip`). Never invent or assume approval from conversational tone.
3. A repair is accepted only when the verification contract for that step passes: declared remediation command exits 0, repair delta stays inside the declared write scope, suppression and test-deletion checks pass, and the required regression test was added or modified.
4. Treat `REPAIR_REJECTED`, `FAILED`, `BLOCKED`, and `TAINTED` as non-ready states. Do not claim readiness from a partial run.
5. Report only what the configured playbook proved at the recorded commit. Always include degradations, skipped lanes, manual checks, and uncovered areas.

## Lifecycle

### 1. Bootstrap (one time per repository)

When the user wants to adopt Dokion in a fresh repository, run:

```bash
dokion init
```

`dokion init`:

- Creates `.dokion/` state, a starter `.dokion/playbook.json`, and `HARDENING.md`.
- Does not install third-party capabilities.
- Requires `BEFORE_WRITE` approval: confirm with the user that it is safe to create `.dokion/**` and `HARDENING.md` in the current repository before invoking.
- Refuses to overwrite an existing `.dokion/playbook.json`. If one already exists, stop and surface that Dokion is already initialized.

Optional follow-ups after init:

```bash
dokion inspect          # Detect stack, scripts, CI, UI/API surfaces (read-only)
dokion doctor           # Check CLIs, runtimes, MCP servers, credentials (read-only)
```

Do not run `dokion configure` from the skill. `dokion configure` edits `.dokion/playbook.json`, which is user-owned. If the user asks to change selection, order, permissions, or gates, walk them through editing `.dokion/playbook.json` directly, or invoke `dokion configure` only after explicit in-conversation approval.

### 2. Validate before execution

Always validate before any execution step (`run`, `autopilot`, `verify`):

```bash
dokion validate
```

`dokion validate` (read-only):

- Checks the playbook against `schemas/dokion-playbook.schema.json`.
- Resolves capability availability against `dokion.json` (catalog entries are inert descriptions, not executions).
- Verifies permissions, dependencies, and command templates.
- Exits non-zero and lists every violation if the playbook is unsound.

To only check the catalog without validating the live playbook:

```bash
dokion validate --catalog-only
```

If `dokion validate` fails, do not run any execution command. Present the violations verbatim and stop.

### 3. Preview the approved loop

Before `dokion run` or `dokion autopilot`, render the loop order without executing:

```bash
dokion plan
```

Use the plan output to confirm:

- Loop and stage order match the user's intent.
- Approval-gated steps are visible up front.
- Skipped or disabled capabilities are surfaced.

If the plan does not match intent, the user must edit `.dokion/playbook.json` directly. Do not patch the plan output.

### 4. Execute

Two execution surfaces exist. Pick exactly one per invocation:

**Bounded loop (single run):**

```bash
dokion run                 # Run the configured loop from its first incomplete step
dokion run <loop-id>       # Run a specific loop
dokion run all             # Run every configured loop in declared order
```

**Bounded autopilot (full autonomous loop):**

```bash
dokion autopilot
```

`dokion autopilot` drives the approved loop through step execution, findings normalization, remediation, rollback on failure, and verification without further prompting, bounded by:

- The user-authored playbook (`.dokion/playbook.json`)
- Documented budgets (see run-budget, retry-policy, stale-run in `src/autopilot/`)
- Immutable approval boundaries (steps gated by the playbook still pause for `dokion approve` / `dokion reject`)

The autopilot never widens write scope, never enables new capabilities, and never upgrades versions. If it encounters an ungated write, an undeclared capability, or a missing approval, it blocks and waits for a decision command.

To recover an interrupted autopilot:

```bash
dokion resume              # Resume from last valid state and exact Git commit context
```

If `dokion resume` reports a stale run identity or commit mismatch, do not force-continue. Surface the mismatch and let the user reconcile state (usually by re-running `dokion validate` and `dokion plan`).

### 5. Decide on gated items

When a step or finding is gated, the skill blocks on a decision. Record the decision through the CLI:

```bash
dokion approve step:<id>    --by <identity> --notes "<reason>"
dokion approve finding:<id> --by <identity> --notes "<reason>"
dokion reject  step:<id>    --by <identity> --notes "<reason>"
dokion reject  finding:<id> --by <identity> --notes "<reason>"
dokion skip    <step-id> --reason "<text>"     # Optional steps only
```

Subject types supported: `step`, `finding`, `fix`, `commit`, `install`, `suggestion`, `deferral`.

After recording a decision, run `dokion resume` to continue the loop.

### 6. Verify (read-only)

`dokion verify` runs the verification gates configured in the playbook without applying any fixes:

```bash
dokion verify
```

Use it:

- After a run completes, to confirm every gate is green.
- After a manual edit outside Dokion, to confirm nothing regressed.
- Before reporting readiness, to anchor the report in a fresh check.

`dokion verify` is `VERIFY_ONLY`: it never writes. A failed verify exits non-zero and reports the failing gates. Do not treat a failed verify as a green run.

### 7. Audit and report

```bash
dokion audit               # Cross-check evidence chain, approvals, and findings against the playbook
dokion findings            # List normalized findings (filterable: --severity HIGH, --status OPEN)
dokion status              # Snapshot of loop state, current step, blockers, readiness
dokion report              # Regenerate HARDENING.md and machine-readable reports
dokion report --format json
```

`dokion audit` (report-only) verifies:

- Evidence records match the append-only chain in `.dokion/state.json`.
- Every write and decision either came from the playbook or has a recorded approval.
- No repair delta escaped its declared write scope.
- No required regression test was suppressed or deleted.

An `AUDIT_FAILED` result is a hard signal. Do not ship or report readiness. Present the failing evidence and stop.

## Error recovery patterns

| Signal | Cause | Action |
| ------ | ----- | ------ |
| `PLAYBOOK_INVALID` | Playbook violates schema or undeclared capability | Run `dokion validate`; surface violations; user edits playbook |
| `CAPABILITY_UNAVAILABLE` | Catalog declares a tool that is not installed | Run `dokion doctor`; surface install recommendation (inert); user installs and reruns |
| `APPROVAL_REQUIRED` | Step/finding is gated | Run `dokion status` to identify the pending subject; present exact subject and scope; wait for `dokion approve` or `dokion reject` |
| `WRITE_SCOPE_VIOLATION` | Repair delta escaped declared scope | Run rolls back to pre-remediation snapshot; do not retry without narrowing the step's declared scope in the playbook |
| `TEST_SUPPRESSED` or `TEST_DELETED` | Regression test was silenced or removed | Hard block; user must restore tests; rerun `dokion validate` then `dokion run` |
| `STALE_RUN` | State references an outdated commit or expired lease | Run `dokion resume`; if mismatch persists, surface and wait for user reconciliation |
| `EVIDENCE_CHAIN_BROKEN` | Append-only state was tampered with | Run `dokion audit`; treat as non-recoverable without user reset (`dokion reset --state-only`) |
| `RUN_BUDGET_EXCEEDED` | Autopilot exceeded configured retries/time | Review `dokion status`, decide whether to extend budget in playbook (user action) or accept partial state |
| `REPAIR_ROLLBACK` | Remediation failed and was rolled back | Inspect evidence, surface to user, do not auto-retry the same step without user input |

For any `BLOCKED`, `FAILED`, `REPAIR_REJECTED`, or `TAINTED` state, the skill stops execution and presents the state. The skill never papers over these states with manual edits to `.dokion/**`.

## Reporting contract

When the user asks for a readiness report:

1. Run `dokion status`, `dokion findings`, and `dokion audit`.
2. Read `HARDENING.md` for the human summary and recorded commit.
3. Report only what the configured playbook proved at that commit.
4. Always include:
   - Active degradations (capabilities that were degraded or skipped)
   - Skipped lanes (loops or stages the user chose not to run)
   - Manual checks (anything the playbook intentionally left to a human)
   - Uncovered areas (capabilities not present in the catalog or playbook)
5. Never state general production readiness from a partial, gated, or failed run.

## Related resources

- `skills/dokion-hardening/SKILL.md` — Run/resume/verify cycle for an already-configured playbook
- `skills/dokion-automation/references/playbook-authoring.md` — How users author and approval-gate playbooks
- `playbooks/reference/*.playbook.json` — Inert reference playbooks (api-service, library-package, web-fullstack)
- `schemas/dokion-playbook.schema.json` — Authoritative playbook contract
- `docs/architecture/bounded-autopilot.md` — Autopilot boundaries and budgets
- `docs/security/threat-model.md` — Trust and threat model
