# Registry Truth Audit

Date: 2026-08-01  
Scope: PR 1 of Issue #47

## Purpose

This audit records the public and runtime behavior removed or disabled before the real federated Registry is implemented. It prevents later work from treating a simulated path as an acceptable starting point.

No quarantined behavior is considered complete. A capability returns only when its protocol, state transition, security boundary, tests, and public documentation work end to end.

## Quarantined behavior and replacement ownership

| Quarantined behavior | Confirmed problem | Current boundary | Replacement workstream |
| --- | --- | --- | --- |
| Hardcoded package catalog | Packages, publisher status, dates, digests, and statistics were constructed in source code rather than loaded from a validated Registry | Unconfigured search returns an empty unavailable snapshot | PR 2 defines Registry schemas; PR 4 implements source loading and refresh |
| Synthetic pull | `pullPackage` generated a different Playbook from catalog metadata and never retrieved publisher-authored bytes | Pull fails with `REGISTRY_SOURCE_REQUIRED` | PR 3 defines deterministic packages; PR 5 implements verified retrieval and cache |
| Local-only publish | Publish added an object to process memory and invented a repository URL without a remote write or verification | Publish fails with `REGISTRY_NOT_IMPLEMENTED` | PR 7 implements packing, Registry-specific publication, remote verification, and receipts |
| No-op sync | `playbooks sync` returned success without resolving a version, writing a lockfile, installing files, or changing activation state | Sync returns a non-zero error result | PR 6 implements install, update, removal, lockfile, activation, and rollback |
| Unsupported marketplace metrics | Downloads, active installs, ratings, execution percentages, trust scores, and rankings had no approved collection or aggregation contract | Metrics and leaderboard actions fail closed; the public site shows none | A separate telemetry ADR is required before any API work; PR 11 may display only proven data |
| Browser-rendered untrusted metadata | The static page inserted catalog fields through `innerHTML` and inline event handlers | `docs/app.js` and `docs/catalog.json` are removed; the page uses static semantic HTML | PR 9 establishes Astro Starlight; PR 11 builds the Store from a validated generated snapshot |
| Ambiguous publisher verification | One hardcoded boolean implied identity, integrity, and trust | No publisher badge is displayed | PR 8 implements explicit provenance states and evaluates established signature and identity proof |
| Installation implied activation | Public copy suggested that a pulled proposal could become active through a no-op sync | Pull, install, and activation are documented as different transitions | PR 6 implements user-approved atomic activation under ADR-0001 and ADR-0004 |

## Preserved behavior

The quarantine does not weaken the production execution engine delivered before this audit:

- `.dokion/playbook.json` remains the sole execution authority.
- Auto-runner uses the production execution path and requires action and verification evidence.
- Native OSV Scanner, Gitleaks, Semgrep, and Trivy outputs are normalized through explicit adapters.
- Missing execution, unsupported scanner output, malformed reports, failed verification, or failed rollback stop the run.
- State revisions, run locking, event integrity, repository identity, worktree policy, approvals, evidence, and rollback remain active.
- Built-in local Playbooks and current import and validation flows remain available where their own contracts are implemented.

## New fail-closed interfaces

### Registry search

An unconfigured Registry search returns a structured unavailable result with an empty package list. It does not populate example data.

### Registry pull

Pull requires a configured and verified source. Until source resolution and package-byte verification exist, it throws:

`REGISTRY_SOURCE_REQUIRED`

No proposal, package directory, lockfile, metric, or telemetry claim is created.

### Registry mutation and ranking

Publish, leaderboard, rate, fork, merge, and other unsupported Registry operations throw:

`REGISTRY_NOT_IMPLEMENTED`

This code identifies a missing subsystem, not a transient successful operation.

### Playbook sync

The existing command surface remains visible for compatibility, but the handler returns a non-zero status and explains that Registry sources, project lockfiles, and atomic install transitions are required.

## Evidence chain

The first round follows explicit RED and GREEN cycles:

1. Registry negative-control tests failed against the simulated catalog, pull, publish, leaderboard, and sync paths.
2. The runtime was changed to fail closed and the Registry tests passed.
3. Public-site tests failed against the marketplace claims and unsafe interactive page.
4. The marketplace application and catalog were removed, and the documentation truth tests passed.
5. ADR contract tests failed before ADR-0003, ADR-0004, and ADR-0005 existed.
6. The accepted decisions were added and indexed.
7. This migration-record test failed while the obsolete design still claimed implementation approval.

Exact CI run identifiers and final verification results are recorded in PR #48.

## Later delivery boundaries

- PR 2: versioned protocol schemas and canonical serialization
- PR 3: deterministic package builder, manifest, and archive verifier
- PR 4: Registry source configuration, federation, refresh, and offline snapshots
- PR 5: downloader, content-addressed cache, corruption handling, and garbage collection
- PR 6: lockfile, install, activation, update, removal, and rollback
- PR 7: real publication and federation workflows
- PR 8: provenance, signatures, identity evidence, deprecation, and revocation
- PR 9: Astro Starlight documentation foundation and GitHub Pages deployment
- PR 10: product and protocol documentation generated from canonical sources
- PR 11: validated Store and package inspection interface
- PR 12: security review, accessibility, browser QA, deployment evidence, and final handoff

## Exit criteria for the quarantine

A disabled operation may return only after its replacement PR proves all of the following:

- exact source and version resolution
- schema-valid metadata
- immutable or explicitly qualified source revision
- verified manifest and artifact bytes
- bounded and safe filesystem handling
- deterministic state transition and rollback
- stable CLI status and JSON output
- negative tests for malformed, malicious, stale, unavailable, and conflicting input
- public copy generated from actual command and protocol behavior

Passing a unit test that writes a local fixture is not sufficient evidence of a network, Registry, install, publish, or marketplace capability.
