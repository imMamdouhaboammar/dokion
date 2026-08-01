# Deterministic Package Builder and Verifier Plan

> **Execution rule:** Implement with TDD. Every package claim must be backed by byte-level tests and negative archive fixtures.

**Goal:** Build real Dokion Playbook package bytes that can be reproduced, hashed, inspected, and rejected safely before any Registry network or installation work begins.

**Architecture:** A package source directory contains payload files. Dokion validates and inventories those files, creates a non-circular canonical `manifest.json`, writes a deterministic USTAR archive, computes the final artifact digest, and verifies the produced bytes through an independent parser. The verifier never extracts untrusted content to disk.

**Format:** `dokion-package-tar-v1`

**Tech:** Bun 1.3.14, TypeScript, Node-compatible filesystem and crypto APIs, AJV 8, custom deterministic USTAR encoder and bounded parser.

## Invariants

- `manifest.json` is generated, appears exactly once at the archive root, and is not listed in its own payload inventory.
- Artifact digest and size are external to `manifest.json`.
- Payload paths are relative POSIX paths and must fit USTAR name and prefix fields.
- Archive entry order is `manifest.json`, then payload files sorted by UTF-8 path order.
- File mode is `0644`, uid and gid are `0`, mtime is `0`, user and group names are empty.
- Only regular files are allowed.
- Directories are implicit and are not archive entries.
- Symlinks, hardlinks, devices, FIFOs, sockets, lifecycle scripts, absolute paths, traversal, duplicate paths, and special entries fail closed.
- Source and archive limits are enforced before allocation or extraction.
- Verification is independent from construction and checks header checksum, type, path, size, manifest schema, semantic invariants, file inventory, file digest, and exact archive termination.
- Package construction grants no installation, activation, or execution authority.

## Default Limits

- Maximum payload files: 10,000
- Maximum single file: 16 MiB
- Maximum expanded payload: 256 MiB
- Maximum archive bytes: 300 MiB
- Maximum USTAR path bytes: 255
- Maximum manifest bytes: 4 MiB

## Tasks

### 1. RED package contract

- [ ] Add tests for canonical JSON ordering.
- [ ] Add tests proving two builds from identical payloads are byte-identical despite source mtimes.
- [ ] Add tests proving one payload-byte change changes file, manifest, and artifact digests.
- [ ] Add tests for exact entry ordering and fixed metadata.
- [ ] Add tests for package inspection without disk extraction.

### 2. Source inventory

- [ ] Walk the source directory without following links.
- [ ] Require `playbook.json`, `README.md`, and `LICENSE`.
- [ ] Reject generated `manifest.json` in the source.
- [ ] Reject symlinks, special files, unsafe paths, and configured lifecycle-script paths.
- [ ] Enforce file-count and byte limits.
- [ ] Hash every payload file.
- [ ] Validate `playbook.json` against the Dokion Playbook schema.

### 3. Canonical manifest

- [ ] Define package build metadata types.
- [ ] Serialize JSON with recursively sorted object keys and a final newline.
- [ ] Validate generated manifest structurally and semantically before archiving.
- [ ] Keep artifact digest outside the manifest.

### 4. Deterministic USTAR writer

- [ ] Encode names and prefixes without PAX or GNU extensions.
- [ ] Encode fixed mode, ownership, and time metadata.
- [ ] Compute valid header checksums.
- [ ] Pad every payload to 512-byte blocks.
- [ ] Append exactly two zero blocks.

### 5. Bounded independent verifier

- [ ] Parse and verify each USTAR header checksum.
- [ ] Reject malformed numeric fields and truncated blocks.
- [ ] Reject non-regular entry types.
- [ ] Reject duplicate or unsafe paths before reading payload data.
- [ ] Enforce archive, entry-count, per-file, manifest, and expanded-size limits.
- [ ] Require `manifest.json` as the first and only manifest entry.
- [ ] Validate manifest schema and semantic invariants.
- [ ] Require exact equality between archive payload paths and manifest inventory.
- [ ] Verify every payload size and SHA-256 digest.
- [ ] Reject non-zero bytes after the two terminating blocks.

### 6. Negative archive suite

- [ ] Path traversal
- [ ] Absolute path
- [ ] Duplicate path
- [ ] Symlink
- [ ] Hardlink
- [ ] Device or FIFO type
- [ ] Invalid header checksum
- [ ] Truncated payload
- [ ] Oversized declared size
- [ ] Missing manifest
- [ ] Duplicate manifest
- [ ] Manifest with unlisted archive file
- [ ] Manifest with missing archive file
- [ ] Tampered payload
- [ ] Tampered manifest
- [ ] Non-zero trailing data

### 7. Public package API

- [ ] `buildPlaybookPackage(request)` returns manifest bytes, artifact bytes, digests, size, and inspection report.
- [ ] `verifyPlaybookPackage(bytes, options)` returns verified manifest and file evidence.
- [ ] No function writes to project state or activates a Playbook.

### 8. CLI `playbooks pack`

- [ ] Add exact CLI metadata and parser options.
- [ ] Require an explicit source directory and output path.
- [ ] Write output atomically only after independent verification succeeds.
- [ ] Print package ID, exact version, manifest digest, artifact digest, artifact size, and file count.
- [ ] Never publish or activate the package.

### 9. Verification gates

- [ ] Focused package tests.
- [ ] Registry protocol conformance.
- [ ] Full Bun tests.
- [ ] Typecheck.
- [ ] Production build.
- [ ] Release binaries.
- [ ] Packed distribution.
- [ ] Clean install.
- [ ] Gemini extension.
- [ ] Residue and credential checks.
- [ ] CodeRabbit review.
- [ ] Scoped security review when an actual scan environment is available.
