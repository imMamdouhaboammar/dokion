# Registry Protocol Schemas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Define and verify the versioned contracts required for Dokion's federated Playbook Registry, immutable package distribution, project lockfiles, source configuration, and provenance reporting.

**Architecture:** JSON Schema Draft 2020-12 is the protocol boundary. Registry indexes point to immutable manifests and artifacts by SHA-256 digest, package manifests enumerate and bind every package file, source configuration grants no selection or execution authority, lockfiles preserve exact resolved state, and provenance exposes separate integrity, source, identity, and signature states. CI validates every schema, positive fixture, and negative authority or integrity case.

**Tech Stack:** Bun 1.3.14, TypeScript, Bun test, Python jsonschema, JSON Schema Draft 2020-12.

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
- Every commit represents one reviewable contract or verification behavior.

---

### Task 1: Add RED protocol inventory tests

**Files:**
- Create: `tests/registry/protocol-schemas.test.ts`

**Interfaces:**
- Consumes: repository schema files and protocol fixtures
- Produces: a failing contract requiring all six v1 schemas, exact identifiers, and positive and negative fixtures

- [ ] Assert that the Registry root, Registry index, package manifest, Registry config, Playbooks lockfile, and provenance schemas exist.
- [ ] Assert that each schema uses Draft 2020-12, rejects unknown top-level fields, and has the exact v1 discriminator.
- [ ] Assert that valid fixtures pass AJV validation.
- [ ] Assert that floating Git refs, malformed digests, authority claims, ambiguous trust fields, and unpinned installs fail.
- [ ] Commit the failing contract and record the CI failure.

### Task 2: Define shared protocol conventions

**Files:**
- Create: `schemas/registry/common.schema.json`
- Create: `docs/protocol/registry-schema-conventions.md`

**Interfaces:**
- Produces: reusable definitions for digest, package ID, semantic version, URI, immutable revision, timestamp, and trust states

- [ ] Define lowercase SHA-256 digest format.
- [ ] Define namespaced package identifiers and exact semantic versions.
- [ ] Define immutable Git commit references as 40-character hexadecimal SHAs.
- [ ] Define explicit integrity, source, identity, signature, compatibility, deprecation, and revocation states.
- [ ] Document canonical JSON requirements and extension policy.
- [ ] Run focused tests and commit.

### Task 3: Define Registry root schema

**Files:**
- Create: `schemas/registry/dokion.registry-root.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-root.json`
- Create: `schemas/registry/fixtures/invalid/registry-root-authority.json`

**Interfaces:**
- Produces: Registry identity, index locations, expiry, source metadata, and zero-authority declaration

- [ ] Require source ID, generated time, expiry, index references, and authority flags fixed to false.
- [ ] Require every index reference to include location, digest, size, and optional immutable source revision.
- [ ] Reject Registry roots that claim installation, activation, selection, substitution, or execution authority.
- [ ] Run focused tests and commit.

### Task 4: Define Registry index schema

**Files:**
- Create: `schemas/registry/dokion.registry-index.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-index.json`
- Create: `schemas/registry/fixtures/invalid/registry-index-mutable-git.json`

**Interfaces:**
- Produces: deterministic package version entries resolved to exact manifest and artifact digests

- [ ] Require source ID, index digest context, package namespace, name, exact version, manifest location and digest, artifact location and digest, size, publication time, and minimum Dokion version.
- [ ] Support local, HTTPS, and immutable Git transports.
- [ ] Require 40-character commit pins for Git transport.
- [ ] Represent deprecation and revocation without popularity metrics.
- [ ] Run focused tests and commit.

### Task 5: Define package manifest schema

**Files:**
- Create: `schemas/registry/dokion.package-manifest.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/package-manifest.json`
- Create: `schemas/registry/fixtures/invalid/package-manifest-path-traversal.json`

**Interfaces:**
- Produces: immutable file inventory for a deterministic `dokion-package/` archive

- [ ] Require package ID, exact version, Playbook path, archive digest, archive size, compatibility, license path, README path, and file inventory.
- [ ] Require every file entry to include relative path, media type, byte size, and digest.
- [ ] Reject absolute paths, `..`, empty segments, backslash paths, symlinks, hardlinks, lifecycle scripts, and duplicate file paths.
- [ ] Keep declared capabilities informational and non-authoritative.
- [ ] Run focused tests and commit.

### Task 6: Define Registry configuration schema

**Files:**
- Create: `schemas/registry/dokion.registry-config.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/registry-config.json`
- Create: `schemas/registry/fixtures/invalid/registry-config-credentials.json`

**Interfaces:**
- Produces: deterministic global or project source configuration with explicit priority and network policy

- [ ] Require unique source names and IDs.
- [ ] Support local, HTTPS, and immutable Git source configuration.
- [ ] Record cache and expiry policy without storing credentials.
- [ ] Reject URL user-info and embedded secrets.
- [ ] Keep source configuration outside package selection and activation authority.
- [ ] Run focused tests and commit.

### Task 7: Define Playbooks lockfile schema

**Files:**
- Create: `schemas/registry/dokion.playbooks-lock.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/playbooks-lock.json`
- Create: `schemas/registry/fixtures/invalid/playbooks-lock-floating-version.json`

**Interfaces:**
- Produces: reproducible project installation state with exact version, digests, source proof, verification results, and explicit activation state

- [ ] Require deterministic ordering metadata and compare-and-swap revision.
- [ ] Require exact package version, manifest digest, artifact digest, file digests, Registry index digest, source ID, sanitized location, source revision, install time, and installing Dokion version.
- [ ] Record `installed_inert`, `active`, or `inactive` explicitly.
- [ ] Record previous version only as rollback evidence.
- [ ] Reject floating versions and authority claims.
- [ ] Run focused tests and commit.

### Task 8: Define provenance schema

**Files:**
- Create: `schemas/registry/dokion.provenance.v1.schema.json`
- Create: `schemas/registry/fixtures/valid/provenance.json`
- Create: `schemas/registry/fixtures/invalid/provenance-ambiguous-verified.json`

**Interfaces:**
- Produces: separate evidence for bytes, Registry metadata, immutable source, publisher identity, signature, compatibility, freshness, deprecation, and revocation

- [ ] Require artifact and manifest digest verification results.
- [ ] Represent publisher identity and signatures as separate states.
- [ ] Reject a top-level or nested generic `verified` field.
- [ ] Allow unavailable signature evidence without implying identity verification.
- [ ] Run focused tests and commit.

### Task 9: Extend conformance validation

**Files:**
- Modify: `schemas/conformance_test.py`
- Modify: `package.json`
- Test: `tests/registry/protocol-schemas.test.ts`

**Interfaces:**
- Produces: positive fixture validation and negative fixture refusal in both Python and Bun CI paths

- [ ] Load every Registry schema into a local reference registry.
- [ ] Validate every `fixtures/valid` document against its declared schema.
- [ ] Require every `fixtures/invalid` document to fail for the intended reason.
- [ ] Add a dedicated `validate:registry-protocol` script.
- [ ] Run contract validation, Bun tests, typecheck, build, and distribution checks.
- [ ] Commit.

### Task 10: Document protocol ownership and review

**Files:**
- Create: `docs/protocol/registry-v1.md`
- Modify: `docs/architecture/registry-truth-audit.md`
- Modify: `docs/superpowers/plans/2026-08-01-registry-protocol-schemas.md`

**Interfaces:**
- Produces: implementation status, schema ownership, migration boundaries, and next-phase package builder prerequisites

- [ ] Document which fields are authoritative and which are display-only.
- [ ] Include validated examples generated from fixtures.
- [ ] Record RED and GREEN CI evidence.
- [ ] Run CodeRabbit and scoped security review when available.
- [ ] Resolve critical and major findings.
- [ ] Mark completed checklist items only after evidence exists.
- [ ] Merge without squashing the meaningful commit sequence.
