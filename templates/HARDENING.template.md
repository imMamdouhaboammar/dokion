# HARDENING.md

<!--
  dokion | journal schema: 1
  Written by the orchestrator. Together with .dokion/state.json this is the run's
  source of truth: any session, agent, or model resumes from these two files.

  Do not hand-edit the STATE tables. Edit .dokion/playbook.json instead — but never
  while a run is in progress: the playbook digest is re-verified before every step and
  a mid-run change aborts the run as TAINTED.

  Sections marked (append-only) are never rewritten, only extended.
-->

## 1. Run metadata

| Field | Value |
|---|---|
| Run id | `<run_id>` |
| Status | `RUNNING` \| `AWAITING_USER` \| `COMPLETED` \| `STOPPED` \| `BLOCKED` \| `FAILED` \| `TAINTED` |
| Started | `<iso8601>` |
| Ended | `<iso8601 or —>` |
| Agent | `claude_code` \| `codex` \| `gemini_cli` \| `other` |
| Model | `<model id>` |
| Baseline commit | `<sha>` |
| Final commit | `<sha or —>` |
| Playbook path | `.dokion/playbook.json` |
| Playbook digest | `sha256:<digest>` |
| Digest last verified | before step `<step_id>` at `<iso8601>` |
| Resumed from | `<prior run_id or —>` |

### Degradations active on this agent

Guarantees unavailable here. Listed so nothing in this report implies parity across agents.

| Degradation | Active | Consequence |
|---|---|---|
| `NO_HOOK_ENFORCEMENT` | yes/no | Playbook mutation is detected by digest, not prevented. |
| `NO_SUBAGENT_ISOLATION` | yes/no | Step permission scopes are advisory, not process-enforced. |
| `NO_PARALLEL_WRITES` | yes/no | Stages declared `PARALLEL` run `SEQUENTIAL`. |
| `NO_WORKTREE_ISOLATION` | yes/no | Concurrent writers unavailable. |

> **If Status is `TAINTED`:** the playbook changed mid-run. Everything after the detection
> point is untrusted. Record expected vs observed digest below, stop, and start a new run.
>
> | | |
> |---|---|
> | Expected | `sha256:<expected>` |
> | Observed | `sha256:<observed>` |
> | Detected before step | `<step_id>` |
> | Detected at | `<iso8601>` |

---

## 2. Project profile (detected)

Detection determines only whether a **declared** step is applicable. It never introduces a
capability or a step that the playbook does not declare.

| Field | Value |
|---|---|
| Languages | |
| Frameworks | |
| Package managers | |
| Has frontend | |
| Has API | |
| Has database | |
| Has LLM surface | |
| Has infrastructure | |
| Monorepo | |
| Build command | |
| Test command | |
| Detected at | |

---

## 3. Declared capability manifest

Every capability the playbook declares, and the result of resolving it. **Nothing may appear
in this table that the playbook does not declare.** Any resolution other than `VERIFIED`
stops the dependent steps with the stated reason — substitution is never permitted.

| Capability | Type | Declared in | Requested | Resolved | Digest match | Resolution | Detail |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Resolution values: `VERIFIED` · `AVAILABLE_UNVERIFIED` · `NOT_INSTALLED` · `INCOMPATIBLE_PLATFORM` · `VERSION_MISMATCH` · `DIGEST_MISMATCH` · `BLOCKED_BY_REGISTRY` · `PERMISSIONS_EXCEED_STEP` · `DEPENDENCY_MISSING`

---

## 4. Execution state

Stages and steps in **exactly the order the playbook declares**. The orchestrator does not
reorder. Out-of-sequence execution appears here only where the playbook explicitly declared
parallel execution, a dependency, or a conditional/retry/recovery branch.

### Stage: `<stage_id>` — `<stage name>`

Status: `PENDING` | Depends on: `<stage_ids>` | Execution: `SEQUENTIAL`

| # | Step | Mode | Status | Approval | Findings (C/H/M/L) | Verification | Evidence | Commits |
|---|---|---|---|---|---|---|---|---|
| 1 | `<step_id>` | `ANALYZE` | `PENDING` | `NEVER` | 0/0/0/0 | — | — | — |

Step status values: `PENDING` · `IN_PROGRESS` · `AWAITING_APPROVAL` · `SUCCEEDED` · `FAILED` · `BLOCKED` · `SKIPPED_INAPPLICABLE` · `SKIPPED_BY_USER` · `STOPPED_BY_POLICY`

**Skipped steps must state a reason.** A skipped step is not a passed step.

| Step | Skip reason |
|---|---|
| | |

---

## 5. Findings ledger

One row per finding. A finding cannot leave `OPEN` without either a verification artifact or
a named human on the record.

| ID | Sev | Step | Standard | Location | Summary | Status | Adversary | Commit |
|---|---|---|---|---|---|---|---|---|
| `DK-SEC-001` | | | | | | `OPEN` | `NOT_RUN` | — |

Status values: `OPEN` · `VALIDATING` · `APPROVED_FOR_FIX` · `FIXING` · `FIXED_PENDING_VERIFICATION` · `VERIFIED` · `REPAIR_REJECTED` · `FALSE_POSITIVE` · `ACCEPTED_RISK` · `DEFERRED` · `BLOCKED` · `NOT_APPLICABLE`

> `FIXED_PENDING_VERIFICATION` means a repair was applied but not yet proven. `VERIFIED`
> additionally means every configured verification command passed **and** validation policy
> did not reject the repair. **Only `VERIFIED` counts toward a release gate.**
>
> `REPAIR_REJECTED` means validation caught the repair as suppression or as incomplete. It is
> not `FALSE_POSITIVE`, and it is not returned to `OPEN` — the record that gaming was detected
> is the point. At most three repair attempts per finding, with rollback between them.

### Counts

| | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|---|
| Open | | | | | |
| Verified fixed | | | | | |
| Rejected by validation | | | | | |
| Deferred | | | | | |
| Accepted risk | | | | | |

---

## 6. Approvals (append-only)

Required by the completion definition: a completion claim is invalid without these on record.

| When | Subject | Type | Decision | By | Notes |
|---|---|---|---|---|---|
| | | | | | |

---

## 7. Scope violations

Any attempt by a step to act outside its declared read/write/network/shell permissions.
**Entries here are hard failures, not warnings.** A run with a non-empty table cannot claim
completion while the `no-scope-violations` gate is blocking.

| When | Step | Attempted | Declared scope | Blocked |
|---|---|---|---|---|
| | | | | |

---

## 8. Evidence index

Every artifact backing a claim in this document. A claim with no artifact is not a result.

| Artifact | Kind | Phase | Step | Digest | Captured |
|---|---|---|---|---|---|
| | | `BEFORE`/`AFTER` | | | |

---

## 9. Residual risk register

What remains open, and who decided it may remain open.

| Finding | Severity | Decision | Rationale | Approved by | Review by |
|---|---|---|---|---|---|
| | | `DEFERRED`/`ACCEPTED_RISK` | | | |

---

## 10. Suggested Playbook Changes

Recommendations only. **Nothing in this section has been applied.** The active playbook is
unchanged by anything written here. Accept, reject, or edit each entry yourself, then update
`.dokion/playbook.json` by hand.

| ID | Category | Summary | Proposed change | Status |
|---|---|---|---|---|
| | | | | `OPEN` |

Categories: `MISSING_REVIEW_COVERAGE` · `CAPABILITY_STACK_MISMATCH` · `EXCESSIVE_PERMISSIONS` · `CONFLICTING_STEPS` · `EXECUTION_ORDER` · `MISSING_VERIFICATION` · `MISSING_RELEASE_GATE` · `DUPLICATE_CAPABILITY` · `DEPRECATED_CAPABILITY` · `SECURITY_CONCERN`

---

## 11. Release gates

| Gate | Blocking | Evaluated | Result | Artifact |
|---|---|---|---|---|
| | | | `NOT_RUN` | |

---

## 11b. Coverage

Which assurance lanes had a capability assigned, and which did not. **An `UNASSIGNED` lane is
a hole in the audit.** It is reported as a hole rather than rounded up to a pass, and it caps
readiness until you either assign a capability or acknowledge the gap by name.

| Lane | Status | Assigned capabilities | Blocking | Acknowledged by |
|---|---|---|---|---|
| application-security | `UNASSIGNED` | — | | |
| api-security-and-contracts | `UNASSIGNED` | — | | |
| database-hardening | `UNASSIGNED` | — | | |
| performance-benchmarking | `UNASSIGNED` | — | | |
| observability | `UNASSIGNED` | — | | |
| supply-chain-and-release-security | `UNASSIGNED` | — | | |
| mobile-native-security | `UNASSIGNED` | — | | |

---

## 11c. Release readiness

| Field | Value |
|---|---|
| Status | `NOT_READY` \| `CONDITIONALLY_READY` \| `READY_FOR_STAGING` \| `READY_FOR_PRODUCTION` |
| Capped by | `<reason, e.g. unassigned blocking lane: observability>` |

**A single validated critical blocker outranks any aggregate score.** Readiness is not an
average.

| Active blocker | Detail | Finding |
|---|---|---|
| | | |

Default blockers: build failure · required test failure · unresolved merge conflict ·
validated critical finding · validated high finding marked blocking by the user · failed
required user flow · missing required approval · capability executed outside approved scope ·
evidence tied to a different commit

### Statement

> This repository passed the user-configured Dokion gates at commit `<sha>`. Remaining
> limitations, manual checks, skipped steps, and accepted risks are recorded in this file.

> Dokion never emits an unqualified "production ready." It knows what your playbook checked,
> not what your system needs. A report that overstates its own scope is worse than no report,
> because it transfers confidence that was never earned.

---

## 12. Completion

A completion claim is valid **only** when every criterion below is true. They are listed
individually so the claim can be audited rather than taken on trust.

| Criterion | Met |
|---|---|
| Every required declared step succeeded | ☐ |
| Every configured verification command passed | ☐ |
| Every configured release gate passed | ☐ |
| No configured blocking finding remains open | ☐ |
| Required user approvals recorded | ☐ |
| Declared manual reviews complete | ☐ |
| Results tied to an exact commit SHA | ☐ |
| Capability manifest reported (§3) | ☐ |
| Exact declared execution order reported (§4) | ☐ |
| Skipped steps and reasons recorded (§4) | ☐ |
| Unapplied recommendations listed (§10) | ☐ |
| Playbook digest stable for the whole run | ☐ |

> **Dokion must never claim completion based on checks or capabilities that were not
> declared in the user-approved playbook.** A run that hardened something real but did it
> outside the playbook is a failed run, not a successful one.

**Claim:** `NOT CLAIMED` — `<reason>`

---

## 13. Run log (append-only)

| When | Event | Step | Detail |
|---|---|---|---|
| | | | |
