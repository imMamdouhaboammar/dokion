# ADR-0002: Dokion repository runtime and package operations are Bun-only

Status: Accepted  
Date: 2026-07-25  
Decision owners: Dokion maintainers and release owners

## Context

Dokion is a TypeScript CLI distributed both as a registry package and as standalone binaries for Linux, macOS, and Windows. Its production claims depend on one reproducible path for dependency installation, tests, TypeScript execution, package packing, publication, and compiled executables.

Using multiple JavaScript package managers would create multiple lockfile semantics, lifecycle-script behaviors, binary shims, registry configurations, cache layouts, and release paths. A check that passes with one package manager would not necessarily prove the artifact produced by another.

Bun provides the runtime, package manager, test runner, bundler, and standalone executable compiler used by the repository. The project also needs Git, system archive tools, Python `jsonschema` for independent development-time schema conformance, and official third-party validators. Those supporting tools do not justify a second JavaScript package-management path.

Declared capabilities executed by Dokion may officially require another installer or runtime. That is a property of the target capability and must remain a visible exception rather than changing Dokion's own repository runtime.

## Decision

Dokion repository JavaScript and TypeScript runtime and package operations are Bun-only.

The following rules are part of this decision:

1. The minimum supported repository runtime is Bun 1.3.14 until a reviewed version update changes it.
2. `bun.lock` is the only JavaScript dependency lockfile committed by the repository.
3. Dependency installation uses `bun install --frozen-lockfile` in CI and release verification.
4. Tests use `bun test`.
5. TypeScript execution and repository scripts use Bun.
6. Package packing uses `bun pm pack` and validates the exact resulting archive.
7. Registry publication uses `bun publish` under the protected release environment.
8. Standalone binaries use `Bun.build` with compile targets, disabled dotenv autoload, and disabled bunfig autoload.
9. npm, yarn, pnpm, and their lockfiles must not be introduced as alternate repository workflows.
10. Node.js compatibility may be tested where useful, but Node.js is not an authorized package-operation path for this repository.
11. Python `jsonschema`, Git, system `tar`, checksum tools, GitHub CLI, and official adapter validators are allowed supporting dependencies when their role is explicit.
12. A declared third-party capability may use a non-Bun upstream installer only when the active playbook permits it and the installer exception is recorded in `.dokion/capabilities.lock.json`.
13. An upstream installer exception never authorizes changing Dokion's own package manager, lockfile, release path, or CI baseline.
14. Secrets used for publication are supplied by the protected environment and must not be persisted in `.npmrc`, `bunfig.toml`, environment files, logs, packages, or reports.

## Consequences

### Positive

- Local, CI, package, and release behavior use one dependency graph and lockfile.
- Clean-install tests reproduce the package path used by consumers.
- Compiled binary behavior is tested against the same runtime that builds it.
- Distribution validation can reject alternate lockfiles and package-manager residue.
- Release incident analysis has one primary JavaScript toolchain to investigate.
- Documentation and contributor setup remain specific and verifiable.

### Costs and constraints

- npm-specific trusted-publishing flows cannot be claimed unless Bun supports the same verified exchange or the decision is superseded.
- Contributors must install the declared Bun version even if another JavaScript runtime is already available.
- Ecosystem tools that only expose npm scripts may require an explicit Bun-compatible invocation or a documented supporting-tool exception.
- Bun compatibility defects can block the release rather than being bypassed with another package manager.
- Version upgrades require package, binary, adapter, and release verification rather than an isolated configuration edit.

### Implementation obligations

- `package.json` must declare the Bun package manager and engine floor.
- CI and release workflows must install frozen Bun dependencies.
- Distribution tests must reject npm, yarn, and pnpm lockfiles and persistent registry credentials.
- Package smoke tests must install the produced archive into an empty Bun project.
- Binary builds must enumerate supported targets and run clean-directory smoke tests.
- Runtime assets required by package and binary modes must be embedded or explicitly shipped.
- Release version checks must reconcile package, adapters, tags, binaries, and release metadata.
- Documentation must not present npm, yarn, or pnpm as equivalent installation paths for repository development.

## Alternatives considered

### npm as the release-only package manager

Rejected because the package would be verified and published through different package-operation paths, weakening correspondence between test evidence and the released archive.

### Support Bun and npm equally

Rejected because equal support requires duplicate lock, lifecycle, shim, cache, clean-install, and release matrices without a demonstrated user need.

### Use Node.js for runtime and Bun only for tests

Rejected because standalone compilation, package behavior, and runtime behavior would be proven by different engines.

### Permit package-manager fallback when Bun fails

Rejected because a fallback turns an explicit compatibility failure into an unreviewed release-path change.

## Amendment rules

This decision may be changed only by a new superseding ADR.

A superseding ADR must:

- identify ADR-0002 explicitly
- state the replacement runtime and package-operation model
- define lockfile ownership and migration
- compare install, test, pack, publish, and binary behavior
- update the supported platform and release matrices
- prove clean installation from the exact produced package
- define secret handling and trusted-publication claims accurately
- remove or migrate Bun-specific scripts and compiled assets without leaving dual undocumented paths
- update contributor, compatibility, security, and release documentation

Editing this ADR to add an alternate package manager without a superseding ADR is prohibited.
