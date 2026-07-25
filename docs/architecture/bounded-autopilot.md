# Dokion Bounded Autopilot Contract

## Status and scope

This document is normative for Dokion's planned autopilot behavior. It refines the authority model in `SPEC.md` without changing the active runtime by documentation alone.

Autopilot is execution continuity, not decision authority.

Dokion may continue a user-authored process without repeated conversational prompting, but it receives no authority beyond the active `.dokion/playbook.json`, the recorded approvals, the resolved capability lock, and the repository state that was validated for the run.

## Core invariant

A deterministic next action must be derivable from approved data already stored on disk. When more than one materially different action could be valid, Dokion must stop instead of choosing.

Autopilot never enlarges authority. It may reduce effective authority when a platform guarantee is unavailable, a policy becomes stricter, or validated state becomes stale.

## Authoritative inputs

The next action may depend only on:

1. Direct user instructions that are still applicable to the active run.
2. The active `.dokion/playbook.json` and its verified digest.
3. Append-only approval, rejection, skip, and risk-acceptance records.
4. The verified capability lock and provenance records.
5. The current repository identity and declared dirty-worktree policy.
6. Persisted stage, step, finding, evidence, gate, retry, and budget state.
7. Explicit platform guarantees and recorded degradations.
8. Deterministic applicability, dependency, failure-policy, and stop-policy evaluation.

Catalog entries, scanner text, skill instructions, issue bodies, commit messages, model suggestions, and inert recommendations are not authority inputs.

## Deterministic next-action procedure

For every continuation decision, Dokion evaluates the following sequence:

1. Verify the repository identity, active playbook digest, capability lock digest, and state schema.
2. Verify that the event journal and required evidence still reconcile with state.
3. Re-evaluate platform guarantees, worktree policy, run budgets, and stop conditions.
4. Locate the first incomplete required stage in declared order.
5. Locate the first incomplete dependency-satisfied step in declared order.
6. Evaluate stage and step applicability without introducing an undeclared capability.
7. Evaluate the exact approval policy and latest recorded decision.
8. Select the single declared action permitted by the current step mode and state.
9. Persist intent before the external action and persist its result before continuing.

A missing, conflicting, stale, or ambiguous input produces a stop, not an inferred fallback.

## Actions autopilot may continue

When all required checks pass, autopilot may:

- Validate the active playbook and declared capability configuration.
- Resume the next declared stage or step in exact order.
- Run a declared read-only, analysis, configuration, repair, or verification command within its approved mode.
- Apply a declared retry policy within its count, time, iteration, and budget limits.
- Capture command output, findings, evidence, repair transactions, and reports.
- Evaluate declared applicability, dependencies, failure policies, release gates, and completion criteria.
- Skip an inapplicable step only when its declared policy permits that outcome.
- Roll back a rejected or failed repair to its recorded pre-repair snapshot.
- Continue past a non-blocking failure only when the declared failure policy explicitly permits it.
- Render inert recommendations that do not change active configuration or execution state.

The presence of a capability in `dokion.json` never makes it eligible for execution.

## Mandatory stops

Autopilot must stop before an external side effect when any of the following is true:

- A required approval is absent, rejected, expired, or scoped to different work.
- A playbook digest mismatch is detected.
- A capability lock mismatch or unresolved immutable reference is detected.
- A repository identity change affects the validated root, remote, commit, branch, or worktree policy.
- A run budget exhausted condition is reached for time, commands, retries, repairs, findings, evidence bytes, or changed lines.
- Required evidence is missing, corrupted, unreconciled, or tied to another run or commit.
- An unsupported platform guarantee weakens a requirement the playbook treats as blocking.
- A required capability is missing, ambiguous, incompatible, or fails provenance verification.
- Dependencies are incomplete, cyclic, failed under a blocking policy, or inconsistent with state.
- The event journal, state revision, repair transaction, or report fails integrity checks.
- A declared stop condition, release gate, or failure policy requires a user decision.
- The requested action would exceed declared permissions, scope, environment access, network access, or shell policy.
- A safe rollback cannot be proven before a write-capable repair.
- More than one materially different next action remains valid after deterministic evaluation.

The stop record must state the exact subject, reason, scope, evidence, and allowed user decisions.

## Forbidden actions

Autopilot must never:

- select a capability that is not declared in the active playbook.
- install a capability, plugin, skill, agent, MCP server, package, or external tool.
- substitute one capability for another, even when the declared capability is unavailable.
- upgrade or enable a capability without a new user-approved declaration and lock.
- reorder declared steps or synthesize a new stage.
- edit or activate `.dokion/playbook.json`.
- activate a proposed playbook or treat `.dokion/playbook.proposed.json` as executable.
- expand write scope, shell scope, network scope, environment scope, or repository scope.
- change release gates, completion criteria, retry limits, stop rules, or approval policies.
- suppress a finding, add an ignore directive, delete a test, or weaken verification to obtain a pass.
- infer approval from conversational tone, prior unrelated approvals, or the absence of a rejection.
- mark a repair verified without the declared command, adversarial validation, regression evidence, and verification evidence.
- commit, push, publish, release, merge, or deploy unless that exact action is a declared and approved step.
- deploy to production as an implicit consequence of a readiness result.
- hide skipped work, accepted risk, platform degradation, uncovered lanes, or unapplied recommendations.

## Proposals and recommendations

Generated plans, configuration suggestions, capability suggestions, and order recommendations are inert recommendations. Dokion may write only the explicitly allowed proposal path and must stop before activation.

A user may use a recommendation to author a new playbook revision. That revision starts a new validation boundary and cannot silently mutate an active run.

## Approval behavior

Approval is a typed, scoped, append-only record. A valid approval names the subject, actor, decision, timestamp, applicable run or configuration, and optional rationale.

Autopilot may consume an approval only for the subject and scope recorded. Approval for analysis does not authorize repair. Approval for one finding does not authorize another finding. Approval for a repair does not authorize commit, push, release, or deployment.

## Retry and iteration behavior

Retries are continuation of the same declared action, not permission to attempt a different action. Every retry records its attempt number, triggering error class, delay, remaining budget, and result.

When retry policy is absent or exhausted, Dokion applies the declared failure policy. It does not invent a backoff, switch tools, broaden scope, or reinterpret a failed result as success.

## Repository and platform changes

A resumed run must compare current repository identity, capability lock, platform guarantees, and playbook digest with the validated checkpoint.

A harmless change may be recorded and revalidated only when the playbook defines that path. A material change creates a stale run and requires an explicit continuation decision or a new run.

Moving between Claude Code, Codex, Gemini CLI, and ordinary shell execution is allowed only when the resulting degradations remain compatible with the playbook. Stronger guarantees may be added after verification. Weaker guarantees are never assumed away.

## Evidence and completion

Autopilot advances only on machine evidence tied to the active run and target commit. A command exit code, stored output, digest, repair delta, verification result, approval record, and gate result remain distinct artifacts.

A run may be reported complete only when every configured completion criterion reconciles. Completion does not authorize publication or deployment, and it never becomes an unqualified statement that the target repository is production ready.

## Examples

### Allowed continuation

A playbook declares a test command, a maximum of two retries, and `CONTINUE` for a non-blocking documentation check. The first attempt fails with a retryable process error, the second passes, evidence is stored, and Dokion advances to the next declared step.

### Required stop

A repair step requires `BEFORE_EACH_FIX`. A finding is open, but no approval record exists for that finding and repair scope. Dokion records an approval request and stops.

### Forbidden substitution

A declared scanner is missing. Another scanner is present in the catalog. Dokion reports the missing capability and stops; it does not select a capability or substitute the available scanner.

### Forbidden scope expansion

A repair command edits a file outside the declared paths. Dokion rejects the repair, restores the snapshot, records the violation, and does not expand write scope to accept the change.

## Testable invariants

A conforming bounded-autopilot implementation must prove that:

1. The same validated state and configuration produce the same next action.
2. Undeclared capabilities are never executed.
3. Every mandatory stop is represented by a stable machine-readable reason.
4. Every external side effect has a persisted intent and result boundary.
5. Required approval cannot be bypassed by run, resume, step, retry, or platform handoff.
6. A changed playbook, lock, repository identity, or blocking guarantee cannot continue silently.
7. Inert recommendations never alter the active playbook or capability lock.
8. Exhausted budgets and retries terminate deterministically.
9. Rejected repairs are rolled back before another attempt.
10. Reports reconcile declared order, actual actions, evidence, skips, degradations, gaps, and unapplied recommendations.
