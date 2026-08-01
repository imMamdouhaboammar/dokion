# Community Playbook Hub Design

Status: Superseded  
Original date: 2026-08-01  
Superseded by: Issue #47, ADR-0003, ADR-0004, and ADR-0005

## Why this design was superseded

The original design combined a hardcoded catalog, local telemetry spool, ranking formula, in-memory publishing, synthesized Playbook proposals, and a static storefront. It described those components as a decentralized marketplace even though they did not form a verifiable distribution protocol.

The implementation could not prove that:

- Registry metadata came from an independently configured source
- pull preserved and verified publisher-authored package bytes
- publish created remote immutable content another client could retrieve
- installation wrote a reproducible project lockfile
- activation remained a separate user-authorized transition
- publisher identity, signatures, metrics, or rankings had trustworthy evidence
- the public website reflected current CLI and protocol behavior

Those gaps conflict with Dokion's fail-closed execution and evidence model. The simulated Hub was quarantined in the first delivery round under Issue #47.

## Replacement decisions

- ADR-0003 defines a federated content-addressed Registry with local filesystem, HTTPS static, and immutable Git source transports.
- ADR-0004 separates integrity, publisher identity, signatures, source state, installation, and activation. Registry metadata never grants execution authority.
- ADR-0005 makes the documentation site and Store static readers of validated snapshots rather than package authority.

The replacement program defines versioned Registry, package, provenance, source configuration, and lockfile schemas before restoring network retrieval or Store actions.

## Removed assumptions

The following assumptions from the original document are rejected:

- an in-memory array is not a Registry
- a SHA-256-shaped string is not proof that remote bytes were retrieved and verified
- synthesizing a new Playbook from metadata is not package pull
- appending to a local catalog is not publish
- a local telemetry event is not a download, install, or execution metric
- one `verified` boolean cannot represent integrity, identity, signature, freshness, and compatibility
- installation does not authorize execution
- browser-visible sample data cannot be presented as product evidence

## Current implementation boundary

Until the replacement protocol is delivered:

- unconfigured Registry search returns an explicit unavailable state
- pull fails with `REGISTRY_SOURCE_REQUIRED`
- publish, ranking, rating, fork, merge, and other unsupported Registry actions fail with `REGISTRY_NOT_IMPLEMENTED`
- Playbook sync fails instead of reporting a no-op success
- the public page contains documentation and rebuild status only

## Authoritative continuation

Implementation continues through Issue #47 and the plan at:

`docs/superpowers/plans/2026-08-01-registry-truth-audit.md`

This file remains as historical evidence of the rejected architecture. It must not be used as an implementation specification.
