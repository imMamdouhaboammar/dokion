# ADR-0005: The public documentation and Store are not package authority

Status: Accepted  
Date: 2026-08-01  
Decision owners: Dokion maintainers, documentation authors, Registry implementers, and release reviewers

## Context

The previous GitHub Pages deployment was a single marketplace page backed by browser-loaded static data. It displayed pull commands, publisher labels, rankings, and operational metrics even though the underlying Registry, package retrieval, publishing, and telemetry paths were simulated or local-only.

A public website is useful for documentation and discovery, but browser rendering cannot prove that package bytes were verified by the Dokion client. Allowing the site to become a mutable Registry authority would create a second package resolution path, increase cross-site scripting and supply-chain exposure, and let visual claims drift away from runtime contracts.

The documentation system must explain the product and help users reach a verified run. The Store must inspect data produced by the real Registry pipeline, not invent or independently reinterpret that pipeline.

## Decision

The website is never the source of truth.

The source of truth is the versioned Registry and package protocol, immutable package bytes, verified digests, explicit provenance states, user-configured source policy, and the project lockfile defined by ADR-0003 and ADR-0004.

The public documentation and Store are generated from a validated static snapshot. Snapshot generation runs outside the browser and must:

1. read only approved Registry sources and canonical repository data
2. validate every source document and package entry against versioned schemas
3. preserve exact source, version, digest, compatibility, deprecation, and provenance states
4. reject invalid, ambiguous, or unsupported entries
5. record the source commit and generation time
6. produce deterministic output suitable for static hosting

There is no arbitrary remote Registry metadata in the browser. The deployed site does not evaluate remote manifests, fetch package descriptions from user-controlled URLs, calculate trust, or resolve package versions at runtime.

No UI claim may precede the corresponding protocol, CLI behavior, test, and evidence. A button, command, badge, status, metric, or compatibility label may appear only when the underlying flow works end to end and the build can prove its source.

The Store may display package namespace, exact version, source, compatibility, integrity state, provenance state, last source refresh, deprecation state, tags, file manifest, and an exact install command generated from canonical CLI metadata.

Until separate approved data contracts exist, the Store must not display ratings, download counts, active installs, execution percentages, trust scores, rankings, editor selections, or publisher verification badges. Missing data is labeled unavailable rather than populated with examples.

Documentation commands are generated from or tested against the canonical CLI command registry. Schema examples validate in CI. Capability claims link to implementation, tests, schemas, or release evidence. Implemented, experimental, planned, deprecated, and unsupported features are labeled separately.

Registry content is treated as untrusted data. The site must escape metadata, sanitize any explicitly supported Markdown, avoid untrusted `innerHTML`, avoid inline event handlers, and prohibit remote scripts without a separate ADR. GitHub Pages deployment uses least-privilege workflow permissions and must not expose credentials or private telemetry.

## Consequences

### Positive

- The website cannot silently change local package authority.
- Product claims remain traceable to runtime and protocol evidence.
- Static hosting remains compatible with GitHub Pages and offline inspection.
- Browser compromise has a smaller effect because package verification happens in the CLI.
- Store failures do not block Registry use, installation, activation, or execution.

### Costs and constraints

- Store data can lag behind source Registries until the next validated build.
- Dynamic marketplace features require a separate non-authoritative service and data contract.
- Registry snapshot generation becomes a release and deployment gate.
- Interactive features are limited to safe navigation, search over generated data, and package inspection.
- Unsupported claims must disappear even when their removal makes the site look less populated.

### Implementation obligations

- Replace the current single-page marketplace with a documentation application and a secondary Store route.
- Generate CLI references, Registry snapshots, and evidence labels from canonical sources.
- Add content tests that forbid unsupported metrics and commands.
- Add link, accessibility, keyboard, responsive, HTML, performance, and visual regression checks.
- Add security tests for malicious package metadata, unsafe Markdown, external links, CSP compatibility, and generated-output secrets.
- Make deployment fail when internal links, schema examples, Registry snapshots, or canonical base paths are invalid.

## Alternatives considered

### Browser fetches Registry sources directly

Rejected because it expands the trust boundary, produces inconsistent results across clients, and makes browser code responsible for protocol validation.

### Website is the official Registry API

Rejected because the Store would become both presentation and package authority, conflicting with federation and local source configuration.

### Keep sample marketplace data until real telemetry exists

Rejected because sample data is indistinguishable from a product claim in a public interface and repeats the false-success problem this program is correcting.

### Remove the website entirely

Rejected because accurate documentation, onboarding, architecture explanation, and safe discovery remain useful. The decision restricts authority, not publishing.

## Amendment rules

This decision may be changed only by a new superseding ADR.

A superseding ADR must:

- name ADR-0005 explicitly
- identify any new website-side authority and its security boundary
- preserve independent CLI verification or formally supersede ADR-0003 and ADR-0004
- define migration and rollback for generated Store data and deployment workflows
- include XSS, supply-chain, stale data, source compromise, credential exposure, and availability analysis
- update documentation generation, CSP, deployment permissions, browser tests, and public claim contracts

Editing this ADR to let the website authorize packages or invent product evidence without a superseding ADR is prohibited.
