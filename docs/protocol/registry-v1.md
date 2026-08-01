# Dokion Federated Registry Protocol v1

Status: schema contracts implemented in PR #50. Retrieval, caching, installation, activation, update, rollback, and publication are not implemented by this document.

## Purpose

The v1 protocol gives independent Registry sources a shared way to describe immutable Playbook package versions. It gives Dokion enough evidence to retrieve exact bytes later, validate their integrity, preserve an auditable project lockfile, and display truthful package information without making the website or a central API authoritative.

## Documents

### `dokion.registry-root.v1`

Identifies one Registry source and the exact index documents it exposes. It records generation and expiration times, each index location, its digest, its size, and an immutable Git revision when applicable.

The root grants no selection, substitution, installation, activation, or execution authority.

### `dokion.registry-index.v1`

Lists exact package versions available from a Registry source. Each entry binds:

- namespace and package name
- exact semantic version
- source transport and immutable revision when applicable
- manifest location, digest, and size
- artifact location, digest, and size
- publication time
- minimum compatible Dokion version
- deprecation and revocation state
- optional provenance and signature-bundle locations

The index intentionally excludes ratings, downloads, active installs, execution success, trust scores, and publisher-verification badges.

### `dokion.package-manifest.v1`

Describes the payload of one deterministic package before installation. It binds package identity and version to:

- the exact `dokion-package-tar-v1` format
- Playbook, README, and license paths
- compatibility metadata
- informational declared capabilities
- every payload file path, media type, size, and digest

The manifest does not contain the artifact digest or artifact size. Those values belong to the Registry index, publication receipt, provenance record, and lockfile after the final package bytes exist.

`manifest.json` is also excluded from its own file inventory. Including the artifact digest inside the artifact, or the manifest digest inside the manifest, creates an unsatisfiable circular hash dependency. The Registry index binds the final manifest bytes and final artifact bytes independently.

Declared capabilities do not grant runtime permission. The active Playbook and Dokion approval model remain authoritative.

### `dokion.registry-config.v1`

Stores deterministic global or project Registry source configuration. It supports local, HTTPS, and commit-pinned Git sources, explicit source priority, cache TTL, and bounded network policy.

Credentials are forbidden in source URLs. This document configures discovery only and grants no package or runtime authority.

### `dokion.playbooks-lock.v1`

Records exact installed project state. Every package entry contains:

- package ID and exact version
- source name, ID, transport, sanitized location, and immutable revision
- Registry index, manifest, and artifact digests
- verified file inventory
- separated provenance states
- compatibility result
- installation time and Dokion version
- explicit lifecycle state
- optional previous version for rollback evidence

`installed_inert` is the default installation outcome. `active` is a separate state that later implementation must reach only through an explicit, atomic activation transition.

### `dokion.provenance.v1`

Reports evidence without collapsing it into a generic verification badge. It records separate observations for:

- expected and observed manifest digest
- expected and observed artifact digest
- immutable Registry source state
- publisher identity state
- signature state
- compatibility
- freshness
- deprecation
- revocation

`MATCH` integrity and `UNPROVEN` publisher identity can coexist. The Store must render both facts rather than infer identity from digest equality.

## Package integrity flow

A publisher creates and verifies package evidence in this order:

1. Inventory and hash every payload file except `manifest.json`.
2. Serialize the manifest canonically from that payload inventory.
3. Hash the final manifest bytes.
4. Build the deterministic tar containing `manifest.json` and the payload files.
5. Hash the final artifact bytes and record their size.
6. Publish a Registry index entry that binds both the manifest digest and artifact digest.
7. Verify remote bytes after publication before issuing a publication receipt.

This order has no self-referential digest.

## Example lifecycle

The schema layer supports this later runtime sequence:

1. Read configured sources.
2. Fetch and validate a Registry root.
3. Fetch an index whose bytes match the root digest.
4. Resolve one exact package version without silent collision handling.
5. Fetch the manifest and artifact into temporary locations.
6. Verify every digest and safe package path.
7. Move verified content into a content-addressed cache.
8. Write an inert project installation and lockfile entry atomically.
9. Require a separate user decision before activation.
10. Preserve previous state for rollback.

Only steps 1 through 4 are described structurally here. No runtime step is considered implemented merely because its schema exists.

## Validation evidence

The canonical fixtures live under `schemas/registry/fixtures/`.

Positive fixtures demonstrate the minimum complete v1 documents. Negative fixtures prove refusal of:

- Registry activation authority
- mutable Git revisions
- package path traversal
- package manifest self-digests
- credentials embedded in source URLs
- floating lockfile versions
- ambiguous generic verification claims

Bun/AJV and Python `jsonschema` must agree on all fixtures in CI.

## Next implementation boundary

The next phase may build a deterministic package builder and verifier only after these contracts are green and reviewed. That phase must establish canonical JSON serialization, deterministic archive bytes, duplicate-path rejection, symlink and hardlink rejection, archive expansion bounds, digest calculation, core-file inventory checks, and an inspection report before any network source or public Store is added.
