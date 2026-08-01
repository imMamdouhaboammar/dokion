# ADR-0004: Registry integrity, identity, installation, and activation are separate decisions

Status: Accepted  
Date: 2026-08-01  
Decision owners: Dokion maintainers, Registry operators, package publishers, and users activating Playbooks

## Context

The removed Community Hub compressed several unrelated claims into one `verified` boolean. A hardcoded publisher flag was treated as identity proof, a syntactically valid digest was presented as artifact verification, a local proposal write was presented as a successful pull, and installation language implied that the package could become active.

These states have different security meanings. Exact bytes can match a digest while the publisher identity remains unknown. A publisher identity can be established while a particular package is deprecated or revoked. A package can be installed correctly while remaining unauthorized for execution. A signature can be unavailable without invalidating an independently verified artifact digest.

ADR-0001 requires user-approved execution authority. Registry features must not create a second authority path.

## Decision

Integrity verification is not publisher identity verification.

Dokion records independent, explicit states for:

- Registry metadata schema validity
- artifact integrity verified or failed
- manifest integrity verified or failed
- immutable source pinned or not proven
- publisher identity unverified or publisher identity verified
- signature verified, signature failed, or signature unavailable
- source fresh, stale, expired, unavailable, or revoked
- package active, inert, deprecated, revoked, or removed
- compatibility satisfied, incompatible, or unknown

No composite `verified` boolean may replace these states in the protocol, CLI, lockfile, reports, or Store.

Registry metadata never grants execution authority. A Registry entry may describe declared capabilities, permissions, compatibility, files, and provenance, but it cannot activate a package or authorize commands.

Pull, install, and activate are separate state transitions:

1. Pull retrieves exact package bytes, verifies them, and places them in the content-addressed cache. It does not modify project authority.
2. Install writes a project-local pinned package record and a deterministic `.dokion/playbooks.lock.json`. The installed package remains inert.
3. Activate requires explicit user intent, validates the installed package and its authority changes, applies existing Dokion approval policy, and atomically creates or composes the active `.dokion/playbook.json`.

Updates and downgrades resolve an exact new version, display changes in capabilities, permissions, files, compatibility, and provenance, then require confirmation. Removing an active package requires a separate deactivation decision. Failed install or activation transitions restore the previous lockfile and active Playbook state.

The lockfile records the source name and ID, credential-redacted source location, immutable source revision, Registry index digest, exact package version, manifest digest, artifact digest, verified file digests, provenance states, compatibility result, installing Dokion version, activation state, and rollback predecessor. Lockfile writes use deterministic ordering, atomic replacement, and compare-and-swap revision control.

Publisher identity verification and signature verification must use established, reviewed protocols. Dokion must not invent a custom signature scheme. Sigstore bundles, signed releases, and signed update frameworks may be evaluated through a separate implementation specification and threat model.

## Consequences

### Positive

- Users can distinguish byte integrity from publisher identity and source freshness.
- Installation cannot silently expand execution authority.
- Reports and the Store can explain exactly which proof exists and which proof is absent.
- Lockfiles preserve reproducible installation evidence and rollback context.
- Signature infrastructure can be added without changing the minimum digest-verification guarantee.

### Costs and constraints

- The CLI and Store expose more states than one badge.
- Install and activation require separate commands and user decisions.
- A package with correct bytes may still carry an unverified publisher identity state.
- Compatibility and provenance failures need detailed, stable error handling.
- Lockfile migrations require schema versioning and careful rollback behavior.

### Implementation obligations

- Define versioned provenance and lockfile schemas with no ambiguous `verified` field.
- Generate exact state labels from validated protocol data, not UI heuristics.
- Make pull, install, activate, update, remove, and deactivate independently testable.
- Capture before and after authority diffs for activation and update.
- Refuse activation when the package, lockfile, source revision, or active Playbook boundary has drifted.
- Add adversarial tests for digest mismatch, stale source, revoked package, signature failure, identity absence, lockfile races, downgrade, active removal, and failed rollback.

## Alternatives considered

### One verified publisher badge

Rejected because it conflates identity, integrity, signature, source freshness, package status, and compatibility.

### Install activates automatically

Rejected because installation would become an undeclared authority transition and violate ADR-0001.

### Trust Registry operator assertions

Rejected as a minimum guarantee. Registry metadata can carry claims, but the client must independently verify bytes and record which identity or signature evidence was actually checked.

### Require signatures for every version 1 package

Deferred. Signature support is desirable, but making it mandatory before identity and update-framework choices are reviewed would encourage custom cryptography or block local and air-gapped sources unnecessarily.

## Amendment rules

This decision may be changed only by a new superseding ADR.

A superseding ADR must:

- name ADR-0004 explicitly
- preserve or formally replace the separation between integrity, identity, installation, and activation
- define migration for existing lockfiles and installed packages
- maintain ADR-0001 or explicitly supersede it in the same program
- include attack analysis for confused authority, downgrade, replay, signature misuse, and lockfile tampering
- update schemas, CLI help, Store labels, reports, and adversarial tests

Editing this ADR to make discovery or installation authorize execution without a superseding ADR is prohibited.
