# Dokion M6 Distribution and Release Plan

**Goal:** Prove that the published Dokion package contains only intended runtime and adapter files, installs from a generated tarball into a clean Bun project, exposes a working CLI, passes official Gemini extension validation, and can be released through a Bun-only GitHub Actions pipeline.

## Non-negotiable boundaries

- Bun remains the runtime, package manager, test runner, packer, publisher, and build tool.
- npm and Yarn CLIs are not used anywhere in development, validation, smoke tests, or release workflows.
- Publishing requires a version tag that exactly matches `package.json` and `gemini-extension.json`.
- Registry authentication is supplied only through a protected GitHub Environment secret at release time. No token, `.npmrc`, or credentialed `bunfig.toml` is committed.
- npm OIDC trusted publishing is not claimed because its automatic token exchange currently requires npm CLI. Dokion records token authentication as a release-platform limitation instead of violating the Bun-only contract.
- `.dokion/playbook.json` remains user-owned and is never generated into the package.
- Marketplace validation never installs or enables a capability for the user.

## Task 1: RED distribution contracts

- Add package metadata and allowlist tests.
- Add adapter validation tests for Claude, Codex, and Gemini manifests.
- Add release-version synchronization tests.
- Add tests that reject secrets, state artifacts, tests, local configuration, and repository-only files from the package tarball.
- Add a clean-install smoke-test contract.

## Task 2: Package allowlist and metadata

- Add repository, homepage, bugs, author, keywords, publishConfig, and `files` fields to `package.json`.
- Include the CLI runtime, embedded schemas and catalog, canonical skill, adapters, reference playbooks, templates, and public documentation.
- Exclude tests, plans, CI internals, local state, diagnostics, and generated output.
- Add `prepack` validation so an invalid distribution cannot be packed or published.

## Task 3: Distribution validator

- Add `scripts/validate-distribution.ts`.
- Run `bun pm pack --ignore-scripts --quiet` into a temporary tarball.
- Extract the tarball with the system `tar` utility and inspect the exact packed tree rather than the source tree.
- Enforce required and forbidden paths.
- Scan packed text files for common secret signatures and private local paths.
- Validate that package and extension versions match.
- Parse Claude JSON and Gemini JSON/TOML adapters.
- Verify every thin wrapper resolves the canonical skill.
- Remove temporary archives and extraction directories on every exit path.

## Task 4: Self-contained runtime and clean-install smoke test

- Embed the JSON Schemas and inert built-in catalog through static imports so the installed CLI never depends on Dokion's repository root.
- Add `scripts/smoke-test-package.ts`.
- Create a real tarball with lifecycle scripts disabled.
- Install that tarball into an empty temporary Bun project with `bun add`.
- Run the installed `dokion --help`, `dokion init`, `dokion doctor`, and `dokion validate --catalog-only`.
- Assert runtime state and report files are created only after `dokion init`.
- Assert no active playbook is silently authored.
- Remove the generated tarball and temporary project on every exit path.

## Task 5: CI and official adapter checks

- Add distribution validation and clean-install smoke test to normal CI.
- Add a separate pinned Gemini CLI validation step using `bunx @google/gemini-cli@<pinned> extensions validate .`.
- Keep the official validator isolated from runtime tests and record its exact pinned version.

## Task 6: Bun-only release workflow

- Add a tag-triggered release workflow.
- Require GitHub-hosted runners and `contents: write`.
- Verify the tag, package version, and Gemini extension version are identical.
- Re-run full CI, distribution validation, clean-install smoke test, and official Gemini validation.
- Build compiled binaries for Linux x64 baseline, Linux ARM64, macOS ARM64, macOS x64, and Windows x64 baseline using Bun cross-compilation.
- Produce the package tarball with `bun pm pack`.
- Publish with `bun publish` only after a protected `npm-release` environment supplies `NPM_TOKEN`.
- Create any registry configuration as an ephemeral runner file, delete it in a trap, and prove it is absent before artifact upload.
- Attach the package tarball, checksums, and binaries to the GitHub release.

## Task 7: Documentation and final verification

- Document the protected GitHub Environment and granular publish-token setup.
- Document the Bun-only limitation that prevents claiming npm OIDC trusted publishing.
- Document package installation and Gemini extension installation from GitHub.
- Run full CI and inspect the tarball manifest.
- Merge only after all checks pass.
