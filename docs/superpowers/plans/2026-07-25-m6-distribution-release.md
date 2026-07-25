# Dokion M6 Distribution and Release Plan

**Goal:** Prove that the published Dokion package contains only intended runtime and adapter files, installs from a generated tarball into a clean Bun project, exposes a working CLI, passes official Gemini extension validation, and can be released through GitHub Actions with npm trusted publishing.

## Non-negotiable boundaries

- Bun remains the runtime, package manager, test runner, and build tool.
- npm CLI is used only as the npm registry packaging and trusted-publishing client.
- Publishing requires a version tag that exactly matches `package.json` and `gemini-extension.json`.
- No workflow may publish from an unverified commit or with a long-lived npm write token.
- `.dokion/playbook.json` remains user-owned and is never generated into the package.
- Marketplace validation never installs or enables a capability for the user.

## Task 1: RED distribution contracts

- Add package metadata and allowlist tests.
- Add adapter validation tests for Claude, Codex, and Gemini manifests.
- Add release-version synchronization tests.
- Add tests that reject secrets, state artifacts, tests, local configuration, and repository-only files from the npm tarball.
- Add a clean-install smoke-test contract.

## Task 2: Package allowlist and metadata

- Add repository, homepage, bugs, author, keywords, publishConfig, and `files` fields to `package.json`.
- Include the CLI runtime, schemas, canonical skill, adapters, reference playbooks, templates, and public documentation.
- Exclude tests, plans, CI internals, local state, diagnostics, and generated output.
- Add `prepack` validation so an invalid distribution cannot be packed or published.

## Task 3: Distribution validator

- Add `scripts/validate-distribution.ts`.
- Run `npm pack --json --dry-run --ignore-scripts` and inspect the exact file list.
- Enforce required and forbidden paths.
- Scan packed text files for common secret signatures and private local paths.
- Validate that package and extension versions match.
- Parse Claude JSON and Gemini JSON/TOML adapters.
- Verify every thin wrapper resolves the canonical skill.

## Task 4: Clean-install smoke test

- Add `scripts/smoke-test-package.ts`.
- Create a real tarball with scripts disabled.
- Install that tarball into an empty temporary Bun project.
- Run the installed `dokion --help`, `dokion init`, `dokion doctor`, and `dokion validate --catalog-only`.
- Assert runtime state and report files are created only after `dokion init`.
- Remove the generated tarball and temporary project on every exit path.

## Task 5: CI and official adapter checks

- Add distribution validation and clean-install smoke test to normal CI.
- Add a separate pinned Gemini CLI validation step using `gemini extensions validate .`.
- Keep the official validator isolated from runtime tests and record its exact pinned version.

## Task 6: Trusted release workflow

- Add a tag-triggered release workflow.
- Require GitHub-hosted runners, `contents: write`, and `id-token: write`.
- Verify the tag, package version, and Gemini extension version are identical.
- Re-run full CI, distribution validation, clean-install smoke test, and official Gemini validation.
- Publish through npm trusted publishing without `NODE_AUTH_TOKEN`.
- Build compiled binaries for Linux, macOS ARM64, and macOS x64 when supported by Bun.
- Attach package tarball, checksums, and binaries to the GitHub release.

## Task 7: Documentation and final verification

- Document npm trusted publisher setup and the required workflow filename.
- Document package installation and Gemini extension installation from GitHub.
- Run full CI and inspect the tarball manifest.
- Merge only after all checks pass.
