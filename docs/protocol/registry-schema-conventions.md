# Registry Schema Conventions

Status: implemented in PR #50 for protocol validation. Runtime source, package, cache, install, and publish engines remain unavailable until later phases of Issue #47.

## Contract boundary

The Registry protocol describes discovery and evidence. It never selects, installs, activates, substitutes, or executes a Playbook. Every top-level v1 document therefore includes an `authority` object whose five authority fields are fixed to `false`.

The active `.dokion/playbook.json` remains the only execution authority. A package can be valid, downloaded, cached, and installed while remaining inert.

## Schema identifiers

Every protocol document has two exact identifiers:

- JSON Schema `$id`, hosted under `https://schemas.dokion.dev/`
- document-level `schema` discriminator such as `dokion.registry-index.v1`

A consumer must reject unknown required versions. It must not infer compatibility from a similar filename or partially matching object.

## JSON and unknown fields

All v1 top-level objects use JSON Schema Draft 2020-12 and `additionalProperties: false`.

Canonical serialization for hashing will be defined and tested by the deterministic package-builder phase. Until that implementation exists, no code may claim that re-serialized JSON has the same digest as publisher bytes.

Extension fields are not accepted implicitly. A future protocol version must define an explicit extension container and its authority limits before extensions are allowed.

## Digests

Integrity values use this exact representation:

```text
sha256:<64 lowercase hexadecimal characters>
```

A digest proves byte equality only. It does not prove publisher identity, review quality, safety, compatibility, popularity, or execution success.

Registry index, manifest, artifact, and included-file digests are separate evidence and must be checked independently.

## Package identity and versions

A package is identified by a namespaced ID:

```text
<namespace>/<name>
```

Every resolved and locked version is an exact semantic version. Floating selectors such as `latest`, branches, ranges, tags, and mutable aliases are not valid lockfile versions.

Version selection policy belongs to the resolver phase. The Registry index only advertises exact package versions.

## Source transports

The v1 protocol models three source transports:

- `local` for development and air-gapped use
- `https` for static Registry documents and artifacts
- `git` pinned to an exact 40-character commit SHA

Git branches and tags are not immutable evidence. HTTPS source freshness and immutability are represented separately from byte-integrity evidence.

Source URLs must not contain user-info or credentials. Authentication material belongs in an external credential provider, never in Registry configuration, cache metadata, lockfiles, logs, or generated Store data.

## Package paths

Package paths are normalized forward-slash relative paths. The schema rejects:

- absolute paths
- `..` traversal
- `.` path segments
- repeated separators
- backslashes
- empty paths

The package verifier phase must add archive-level enforcement for symlinks, hardlinks, duplicate entries, special files, file-count bounds, individual size bounds, total expanded size, and archive bombs.

## Trust state separation

The protocol has no generic `verified` boolean. It records distinct states for:

- manifest integrity
- artifact integrity
- immutable source pinning
- Registry freshness
- publisher identity
- signature evidence
- compatibility
- deprecation
- revocation

A valid digest with `publisher_identity: UNPROVEN` means the downloaded bytes match the Registry record, not that the publisher has been authenticated.

## Testing

Two independent validators cover the contracts:

- Bun and AJV validate the six v1 contracts and all canonical fixtures
- Python `jsonschema` validates the same fixtures offline using a local schema store

Every invalid fixture represents a refusal case, not merely malformed sample data. CI must fail if any invalid fixture becomes accepted.
