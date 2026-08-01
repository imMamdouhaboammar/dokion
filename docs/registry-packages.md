# Registry Package Builder and Verifier

This document defines the executable `dokion registry` package surface introduced for the Registry epic in Issue #47.

## Commands

### `dokion registry pack`

```text
dokion registry pack <directory> --output <path> [--overwrite] [--format human|json]
```

The command reads an explicit source directory, validates its package build metadata and declared files, generates a canonical `manifest.json`, and writes one deterministic `dokion-package-tar-v1` archive.

The source directory must contain:

```text
dokion-package.json
playbook.json
README.md
LICENSE
```

Additional files must be declared by relative package path in `dokion-package.json`.

The archive root is always:

```text
dokion-package/
```

The output is first written to a temporary file, synchronized where supported, and published atomically. Existing output is not replaced unless `--overwrite` is explicit.

### `dokion registry verify-package`

```text
dokion registry verify-package <archive> [--package <namespace/name>] [--version <exact-version>] [--format human|json]
```

Verification is read-only. It reads archive headers before package payload interpretation, applies structural limits, validates every path and entry type, validates `manifest.json`, verifies the declared file inventory, sizes, SHA-256 digests, package identity, exact version, and compatibility, then returns structured evidence.

Verification performs no extraction, installation, activation, substitution, selection, or execution. It does not read or modify `.dokion/playbook.json` or project state.

## Deterministic format

`dokion-package-tar-v1` is an uncompressed USTAR stream with:

- root `dokion-package/`
- regular files only
- UTF-8 NFC relative paths
- bytewise UTF-8 entry ordering
- mode `0644`
- UID and GID `0`
- modification time `0`
- canonical JSON for generated `manifest.json`
- two terminal zero blocks

Identical input bytes and build metadata produce byte-identical archive bytes. Source timestamps, source file modes, and declaration order do not affect the result.

## Manifest boundary

The generated package manifest describes:

- package namespace, name, and exact version
- required payload paths
- compatibility
- declared capabilities
- each payload file path, media type, exact byte size, and SHA-256 digest
- explicit zero-authority metadata

The internal manifest does not contain the digest of the complete archive and does not contain a digest of its own `manifest.json` bytes. The artifact digest belongs to Registry Index or external distribution metadata.

Registry metadata grants no selection, substitution, installation, activation, or execution authority. `.dokion/playbook.json` remains the sole execution authority.

## Fail-closed checks

The builder and verifier reject, with explicit Dokion error codes:

- absolute paths, backslashes, empty or dot path segments, traversal, and encoded separator attempts
- duplicate normalized paths and case collisions
- symlinks, hardlinks, devices, FIFOs, sockets, and unsupported archive entry types
- undeclared files and missing declared files
- unknown manifest fields and non-zero authority claims
- lifecycle scripts
- mismatched file size or digest
- malformed archive headers, checksums, termination, or UTF-8
- compressed archives
- excessive archive size, file count, individual file size, or total payload size
- incompatible Dokion versions or platforms
- unexpected package identity or version

Invalid entries are never silently ignored.

## Next-phase interfaces

The builder exposes artifact digest, artifact size, manifest digest, package identity, version, and canonical manifest evidence. The verifier exposes the same immutable artifact identity plus verified file evidence and compatibility state.

These interfaces are intended for later source retrieval, immutable cache writes, artifact digest comparison, install transactions, lockfile compare-and-swap updates, and explicit activation. Those state transitions are not implemented by this package builder and verifier phase.
