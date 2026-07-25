# Dokion M6 Release Completion Plan

**Context:** PR #9 was merged after distribution validation and clean-install smoke tests passed, but before the tag-triggered release workflow, cross-platform binaries, and release documentation were committed. This follow-up closes only those remaining M6 release tasks.

## Constraints

- Bun is the only JavaScript runtime, package manager, packer, publisher, test runner, and compiler.
- npm and Yarn CLIs are forbidden.
- `.dokion/playbook.json` remains user-owned.
- No registry credential is stored in the repository or uploaded as an artifact.
- npm OIDC trusted publishing is not claimed because automatic exchange requires npm CLI.
- Registry publication uses `bun publish` with `NPM_CONFIG_TOKEN` from the protected `npm-release` GitHub Environment.

## Tasks

1. Add RED tests for release workflow invariants, version gates, cross-compile targets, and documentation.
2. Add a Bun cross-platform build script for Linux x64 baseline, Linux ARM64, macOS ARM64, macOS x64, and Windows x64 baseline.
3. Add a tag-triggered workflow that re-runs every release gate, packs with Bun, publishes with Bun, and creates or updates a GitHub release.
4. Make reruns idempotent by skipping registry publication when the immutable version already exists and replacing GitHub release assets.
5. Add `docs/RELEASING.md` with the protected-environment and granular-token setup.
6. Validate the workflow contains no npm/Yarn commands, no OIDC claim, no credential file creation, and no unsupported authority expansion.
7. Run full CI and merge only after the follow-up PR is green.
