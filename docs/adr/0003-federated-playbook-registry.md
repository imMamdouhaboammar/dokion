# ADR-0003: Playbook distribution uses a federated content-addressed Registry

Status: Accepted  
Date: 2026-08-01  
Decision owners: Dokion maintainers and users configuring Registry sources

## Context

Dokion needs a real distribution model for Playbook packages. The removed Community Hub used one hardcoded in-memory catalog and presented it as a decentralized marketplace. It could not prove where metadata came from, preserve publisher bytes, resolve immutable versions, survive offline use, or let users choose independent sources.

A central service can make discovery convenient, but making it the mandatory authority would create one availability, policy, privacy, and governance dependency. A single mutable JSON file in the Dokion repository has similar problems: it is not federation, namespace ownership is ambiguous, and a mutable branch cannot by itself prove which bytes were reviewed.

The Registry must support independent publishers and air-gapped use without weakening ADR-0001. Discovery is not execution authority.

## Decision

Dokion will use a federated Registry model built on independently configured sources and content-addressed package verification.

The version 1 transport boundary supports:

1. a local filesystem source for development and air-gapped operation
2. an HTTPS static source with bounded retrieval and cache validation
3. a Git repository pinned to an immutable commit

The official Dokion Registry is a removable default. Users may add, remove, disable, inspect, verify, and prioritize sources. A project may pin a different source set from the global configuration.

Each source publishes versioned Registry root and index documents. Index entries identify an exact package version, manifest location and digest, artifact location and digest, package size, compatibility boundary, publication time, and an immutable source revision where the transport can provide one.

Package artifacts and verified extracted files are stored in a content-addressed cache keyed by artifact digest. The cache is an implementation aid, not authority. A cache entry is usable only after its manifest, artifact, paths, file sizes, and file digests have been verified.

Source priority is deterministic. Identical package names from different sources remain source-qualified. Unqualified namespace collisions fail closed. Dokion must not silently choose a winner, merge metadata, or infer ownership.

Registry refresh is bounded and atomic. A failed or invalid refresh preserves the last verified cache and records whether it is fresh, stale, expired, unavailable, invalid, or untrusted. Offline operation may use a still-acceptable verified snapshot under explicit freshness policy.

OCI artifacts may be evaluated after the transport interface, package format, provenance states, and lockfile contracts are stable. OCI is not required for version 1.

## Consequences

### Positive

- Independent communities can host Registries without a mandatory Dokion service.
- Local and air-gapped workflows use the same package and verification contracts.
- Exact source and package references can be reproduced from a lockfile.
- A compromised or unavailable source does not automatically disable other configured sources.
- The public Store can be generated from verified snapshots instead of becoming a privileged runtime dependency.

### Costs and constraints

- Namespace and source qualification are visible to users.
- The client must implement transport-specific retrieval, cache, expiry, and error behavior.
- Federation does not provide publisher identity by itself.
- Search across many sources may expose partial results and source-specific failures.
- Revocation, deprecation, and replacement metadata require explicit protocol fields and freshness handling.

### Implementation obligations

- Add versioned schemas for Registry root, Registry index, source configuration, package manifest, provenance, and project lockfile.
- Support deterministic source IDs and credential-redacted source descriptions.
- Bound redirects, response bytes, index entries, package sizes, file counts, and extraction size.
- Reject path traversal, absolute paths, symlinks, hardlinks, duplicate normalized paths, and digest mismatches.
- Download and extract through temporary paths, then atomically commit only verified content.
- Lock concurrent cache writers and quarantine corrupted entries.
- Add fixtures proving federation, collisions, stale cache, offline use, invalid refresh, and source removal.

## Alternatives considered

### Mandatory central hosted marketplace API

Rejected as the authority path because it creates one required service and conflicts with the decentralized requirement. A future API may mirror non-authoritative discovery or telemetry data, but package verification and installation cannot depend on it.

### One catalog committed to the Dokion repository

Rejected because one mutable catalog is not federation and cannot represent independent source policy cleanly.

### Direct arbitrary GitHub repository URLs without Registry metadata

Rejected because package identity, compatibility, digests, file manifests, expiry, deprecation, and namespace collision behavior would remain undefined.

### OCI-only Registry

Deferred because OCI can become an additional transport after the base package and trust contracts are proven. Making it the first and only transport would make local and simple static publishing unnecessarily dependent on container tooling.

## Amendment rules

This decision may be changed only by a new superseding ADR.

A superseding ADR must:

- name ADR-0003 explicitly
- preserve user-configurable sources or justify replacing federation
- define migration for existing source configuration, cached artifacts, and lockfiles
- preserve immutable package verification and deterministic source resolution
- model namespace collision, source compromise, replay, downgrade, and offline risks
- update Registry schemas, CLI contracts, Store generation, security documentation, and tests

Editing this ADR to make one mutable service the silent authority without a superseding ADR is prohibited.
