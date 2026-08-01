# Registry Protocol Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Define and verify the versioned contracts required for Dokion's federated Playbook Registry, immutable package distribution, project lockfiles, source configuration, and provenance reporting.

**Architecture:** JSON Schema Draft 2020-12 provides structural validation. Explicit semantic validators enforce cross-field invariants that JSON Schema cannot express reliably, including unique source identities, unique package paths, declared core-file membership, and digest-state consistency. Registry indexes bind final manifest and artifact bytes by SHA-256. Package manifests bind payload files but never hash themselves or the containing archive. Registry metadata grants no selection or execution authority.

**Tech Stack:** Bun 1.3.14, TypeScript, Bun test, AJV 8, Python 3.13, Python jsonschema, JSON Schema Draft 2020-12.

## Global Constraints

- `.dokion/playbook.json` remains the sole execution authority.
- Pull, install, and activation are separate transitions.
- Registry metadata never grants execution authority.
- All package and manifest integrity values use lowercase `sha256:<64 hex>` digests.
- Mutable source references cannot be represented as immutable proofs.
- One ambiguous `verified` boolean is forbidden.
- Unknown fields fail closed unless a schema explicitly defines an extension point.
- Ratings, downloads, installs, success rates, trust scores, and publisher-verification claims are out of scope.
- Every schema is versioned with an exact `schema` discriminator.
- Digest ownership must be acyclic.
- Every commit represents one reviewable contract or verification behavior.

---

### Task 1: Add RED protocol inventory tests

**Files:**
- Create: `tests/registry/protocol-schemas.test.ts`

**Interfaces:**
- Consumes: repository schema files and protocol fixtures
- Produces: a failing contract requiring all six v1 schemas, exact identifiers, and positive and negative fixtures

- [x] Assert that the Registry root, Registry index, package manifest, Registry config, Playbooks lockfile, and provenance schemas exist.
- [x] Assert that each schema uses Draft 2020-12, rejects unknown top-level fields, and has the exact v1 discriminator.
- [x] Assert that valid fixtures pass AJV validation.
- [x] Assert that floating Git refs, malformed digests, authority claims, ambiguous trust fields, and unpinned installs fail.
- [x] Commit the failing contract and record the CI failure.

### Task 2: Define shared protocol conventions

**Files:**
- Create: `schemas/registry/common.schema.json`
- Create: `docs/protocol/registry-schema-conventions.md`

**Interfaces:**
- Produces: reusable definitions for digest, package ID, exact SemVer, credential-free HTTPS URI, immutable revision, timestamp, and trust states

- [x] Define lowercase SHA-256 digest format.
- [x] Define namespaced package identifiers and exact semantic versions, including SemVer prerelease leading-zero rules.
- [x] Define immutable Git commit references as 40-character hexadecimal SHAs.
- [x] Define explicit integrity, source, identity, signature, compatibility, deprecation, and revocation states.
- [x] Document canonical JSON requirements, extension policy, and acyclic digest ownership.
- [x] Run focused tests and commit.

### Task 3: Define Registry root schema

**Files:**
- Create: `schemas/registry/dokion.registry-root.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-root.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/registry-root-*.json`

**Interfaces:**
- Produces: Registry identity, transport-bound index locations, expiry, immutable revision evidence, and zero-authority declaration

- [x] Require source ID, generated time, expiry, index references, and authority flags fixed to false.
- [x] Require every index reference to include location, digest, and size.
- [x] Require immutable revision evidence for Git-owned indexes.
- [x] Require credential-free HTTPS index locations for HTTPS sources.
- [x] Reject Registry roots that claim installation, activation, selection, substitution, or execution authority.
- [x] Run focused tests and commit.

### Task 4: Define Registry index schema

**Files:**
- Create: `schemas/registry/dokion.registry-index.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-index.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/registry-index-*.json`

**Interfaces:**
- Produces: deterministic package-version entries resolved to exact manifest and artifact digests

- [x] Require source ID, package namespace, name, exact version, manifest location and digest, artifact location and digest, size, publication time, and minimum Dokion version.
- [x] Support local, HTTPS, and immutable Git transports.
- [x] Require 40-character commit pins for Git transport.
- [x] Constrain forwarded manifest, artifact, provenance, and signature locations for HTTPS sources.
- [x] Represent deprecation and revocation without popularity metrics.
- [x] Run focused tests and commit.

### Task 5: Define package manifest schema and semantic invariants

**Files:**
- Create: `schemas/registry/dokion.package-manifest.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/package-manifest.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/package-manifest-*.json`
- Create semantic validator: `src/registry/protocol-semantics.ts`

**Interfaces:**
- Produces: immutable payload inventory for a deterministic `dokion-package-tar-v1` archive

- [x] Require package identity, exact version, package format, Playbook path, compatibility, license path, README path, and payload-file inventory.
- [x] Keep the artifact digest and artifact size outside the manifest to avoid circular hashing.
- [x] Exclude `manifest.json` from its own payload-file inventory.
- [x] Require every payload entry to include relative path, media type, byte size, and digest.
- [x] Reject absolute paths, `..`, empty segments, backslash paths, and manifest self-reference structurally.
- [x] Reject duplicate file paths semantically.
- [x] Require `playbook_path`, `readme_path`, and `license_path` to reference listed payload files.
- [x] Keep declared capabilities informational and non-authoritative.
- [x] Defer archive-level symlink, hardlink, special-file, lifecycle-script, and expansion-bound checks to the package builder and verifier phase.
- [x] Run focused tests and commit.

### Task 6: Define Registry configuration schema and identity invariants

**Files:**
- Create: `schemas/registry/dokion.registry-config.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-config.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/registry-config-*.json`
- Extend: `src/registry/protocol-semantics.ts`

**Interfaces:**
- Produces: deterministic global or project source configuration with explicit priority and network policy

- [x] Compose local, HTTPS, and Git source variants with Draft 2020-12 `unevaluatedProperties: false` instead of duplicating common fields.
- [x] Require unique source names and IDs semantically.
- [x] Support local, HTTPS, and immutable Git source configuration.
- [x] Record cache and expiry policy without storing credentials.
- [x] Reject URL user-info and embedded secrets.
- [x] Keep source configuration outside package selection and activation authority.
- [x] Run focused tests and commit.

### Task 7: Define Playbooks lockfile schema

**Files:**
- Create: `schemas/registry/dokion.playbooks-lock.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/playbooks-lock.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/playbooks-lock-*.json`

**Interfaces:**
- Produces: reproducible project installation state with exact version, digests, source proof, verification results, and explicit activation state

- [x] Require compare-and-swap revision metadata.
- [x] Require exact package version, manifest digest, artifact digest, file digests, Registry index digest, source ID, sanitized location, source revision, install time, and installing Dokion version.
- [x] Record `installed_inert`, `active`, or `inactive` explicitly.
- [x] Record previous version only as rollback evidence.
- [x] Reject floating versions, embedded credentials for HTTPS and Git sources, and authority claims.
- [x] Run focused tests and commit.

### Task 8: Define provenance schema and semantic integrity checks

**Files:**
- Create: `schemas/registry/dokion.provenance.v1.schema.json`
- Create positive fixtures under: `schemas/registry/fixtures/valid/provenance*.json`
- Create refusal fixtures under: `schemas/registry/fixtures/invalid/provenance-*.json`
- Extend: `src/registry/protocol-semantics.ts`

**Interfaces:**
- Produces: separate evidence for bytes, Registry metadata, immutable source, publisher identity, signature, compatibility, freshness, deprecation, and revocation

- [x] Require expected digests and explicit integrity states.
- [x] Require observed digests only for `MATCH` and `MISMATCH`; forbid them for `NOT_CHECKED` and `UNAVAILABLE`.
- [x] Reject `MATCH` when expected and observed digests differ.
- [x] Reject `MISMATCH` when expected and observed digests are equal.
- [x] Represent publisher identity and signatures as separate states.
- [x] Reject a generic `verified` field.
- [x] Allow unavailable evidence without implying identity or byte verification.
- [x] Run focused tests and commit.

### Task 9: Extend conformance validation

**Files:**
- Create and modify: `schemas/registry/conformance_test.py`
- Create: `schemas/registry/invalid-fixture-expectations.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/registry/protocol-schemas.test.ts`
- Test: `tests/registry/python-conformance.test.ts`

**Interfaces:**
- Produces: positive fixture validation and exact negative refusal causes in both Python and Bun CI paths

- [x] Load every Registry schema into a local reference Registry.
- [x] Validate every `schemas/registry/fixtures/valid/*.json` document structurally and semantically.
- [x] Require every `schemas/registry/fixtures/invalid/*.json` document to fail at its declared JSON pointer and keyword.
- [x] Recursively inspect Python `ValidationError.context` so combinators do not hide the actual refusal cause.
- [x] Assert the expectation matrix exactly matches the invalid-fixture directory.
- [x] Mutate and reject all five authority fields across all six contracts.
- [x] Add a dedicated `validate:registry-protocol` script and invoke it explicitly in CI.
- [ ] Run contract validation, all Bun tests, typecheck, build, release, distribution, clean-install, Gemini, and residue checks on the final reviewed head.
- [ ] Commit final GREEN evidence.

### Task 10: Document protocol ownership and complete review

**Files:**
- Create: `docs/protocol/registry-v1.md`
- Create: `docs/protocol/registry-schema-conventions.md`
- Create and update: `docs/protocol/registry-v1-verification.md`
- Modify: `docs/architecture/registry-truth-audit.md`
- Modify: `docs/superpowers/plans/2026-08-01-registry-protocol-schemas.md`

**Interfaces:**
- Produces: implementation status, schema ownership, migration boundaries, review evidence, and package-builder prerequisites

- [x] Document which fields are authoritative and which are display-only.
- [x] Document acyclic manifest and artifact digest ownership.
- [x] Include examples validated from repository fixtures.
- [x] Record RED evidence and the first GREEN CI baseline.
- [x] Run CodeRabbit and receive actionable review findings.
- [x] Address the reported structural and semantic findings in code and tests.
- [ ] Run CodeRabbit again on the final head and resolve remaining critical and major findings.
- [ ] Record the final GREEN CI run and exact fixture/test counts.
- [ ] Record the unavailable Codex Security execution environment without claiming a scan.
- [ ] Merge by rebase, not squash, so the meaningful commit sequence reaches `main`.
