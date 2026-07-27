# Evidence, Audit, Reporting, and Readiness Backlog

## Scope

Make every Dokion result independently checkable. Human and machine reports must be derived from validated state and evidence, never from model confidence or unsupported claims.

P0 blocks public-beta promotion. P1 blocks a broader production-grade claim unless the surface is explicitly excluded.

## Backlog

### EVID-001 Evaluate every completion criterion

- Priority: P0
- Depends on: CORE-003
- Primary files: `src/readiness/completion.ts`, `schemas/dokion-state.schema.json`
- Verification: `tests/readiness/completion.test.ts`
- Deliverable: Store pass, fail, blocked, or not-applicable for each declared criterion with evidence references and evaluator version.
- Acceptance: A run cannot become complete while a required criterion is absent, stale, blocked, or unreconciled.

### EVID-002 Centralize qualified readiness statements

- Priority: P0
- Depends on: EVID-001
- Primary files: `src/readiness/readiness-statement.ts`
- Verification: `tests/readiness/statement.test.ts`
- Deliverable: Generate one statement tied to subject, repository commit, playbook digest, lock digest, gates, coverage, degradations, exclusions, and verification time.
- Acceptance: All human and JSON surfaces use the formatter and unqualified production-ready wording fails tests.

### EVID-003 Report declared execution and used capabilities

- Priority: P0
- Depends on: CAP-001, EVID-001
- Primary files: `src/report/sections/execution.ts`
- Verification: `tests/report/execution-section.test.ts`
- Deliverable: List every stage and step in declared order with actual disposition, module, tool, skill, plugin, adapter, version, digest, attempts, and evidence.
- Acceptance: Unexecuted, skipped, blocked, and failed work remains visible and report order matches the active playbook.

### EVID-004 Report exceptions and unapplied work

- Priority: P0
- Depends on: CORE-009, EVID-001
- Primary files: `src/report/sections/exceptions.ts`
- Verification: `tests/report/exceptions-section.test.ts`
- Deliverable: Render skips, manual reviews, accepted risks, deferrals, blocked lanes, stale evidence, degradations, and inert recommendations with actor and reason.
- Acceptance: No exception can disappear from summary or readiness evaluation.

### EVID-005 Add a versioned deterministic JSON report

- Priority: P0
- Depends on: EVID-002, EVID-003, EVID-004
- Primary files: `src/report/json-report.ts`, `schemas/dokion-report.schema.json`
- Verification: `tests/report/json-report.test.ts`
- Deliverable: Emit a schema-valid report with stable ordering and repository-relative artifact references.
- Acceptance: Two renders from identical validated inputs are byte-for-byte equal and contain no secrets or private absolute paths.

### EVID-006 Add SARIF export

- Priority: P1
- Depends on: EVID-005
- Primary files: `src/export/sarif.ts`
- Verification: `tests/export/sarif.test.ts`
- Deliverable: Map normalized findings to SARIF 2.1.0 with rule provenance, locations, severity, fingerprints, status, and evidence links.
- Acceptance: Accepted, deferred, blocked, and false-positive findings are not converted into fixed results.

### EVID-007 Add JUnit verification export

- Priority: P1
- Depends on: EVID-005
- Primary files: `src/export/junit.ts`
- Verification: `tests/export/junit.test.ts`
- Deliverable: Export stages, steps, verification commands, and gates as deterministic CI test suites.
- Acceptance: Blocked, skipped, failed, and errored outcomes remain distinct and export never mutates Dokion state.

### EVID-008 Build evidence manifests and checksums

- Priority: P0
- Depends on: STATE-004
- Primary files: `src/evidence/manifest.ts`, `schemas/dokion-evidence-manifest.schema.json`
- Verification: `tests/evidence/manifest.test.ts`
- Deliverable: Create a sorted manifest of artifact path, size, media type, digest, producer, run, commit, redaction status, and retention class.
- Acceptance: Missing, altered, duplicated, cross-run, and unmanifested required evidence is detected.

### EVID-009 Compare two Dokion runs

- Priority: P1
- Depends on: EVID-005, EVID-008
- Primary files: `src/report/compare-runs.ts`, `src/cli/handlers/compare.ts`
- Verification: `tests/report/compare-runs.test.ts`
- Deliverable: Explain new, resolved, regressed, changed, stale, and incomparable findings, gates, coverage, playbooks, locks, and platforms.
- Acceptance: Comparison is read-only, refuses false equivalence, and never merges or rewrites run state.

### EVID-010 Add an independent audit command

- Priority: P0
- Depends on: STATE-004, EVID-005, EVID-008, EXEC-009
- Primary files: `src/audit/audit-run.ts`, `src/cli/handlers/audit.ts`
- Verification: `tests/audit/audit-run.test.ts`
- Deliverable: Verify schemas, state revision, journal chain, repository identity, playbook and lock digests, approvals, transactions, evidence checksums, reports, and completion.
- Acceptance: `dokion audit` runs without executing capabilities and returns precise failures for every tampered-artifact fixture.

### EVID-011 Define evidence retention and export bundles

- Priority: P1
- Depends on: EVID-008
- Primary files: `src/evidence/retention.ts`, `src/export/run-bundle.ts`
- Verification: `tests/evidence/retention-export.test.ts`
- Deliverable: Add explicit retention classes, safe pruning rules, portable bundle export, and import verification without active-run activation.
- Acceptance: Required evidence cannot be pruned. Exported bundles verify independently and contain no credentials or private absolute paths.

### EVID-012 Generate the promotion sign-off record

- Priority: P0
- Depends on: EVID-002, EVID-010, PROD-013
- Primary files: `src/readiness/promotion-signoff.ts`, `schemas/dokion-promotion-signoff.schema.json`
- Verification: `tests/readiness/promotion-signoff.test.ts`
- Deliverable: Create a release-bound record containing versions, commits, digests, claimed surfaces, playbooks, fixtures, workflow links, limitations, defects, reviewers, and revalidation date.
- Acceptance: The record is generated only when PG-001 through PG-012 evidence is present and every promoted blocking gate passes.
