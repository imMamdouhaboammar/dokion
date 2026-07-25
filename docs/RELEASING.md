# Releasing Dokion

Dokion releases are Bun-only. Bun runs the tests, validates contracts, inspects the package archive, installs the clean smoke-test package, cross-compiles binaries, packs the registry archive, and publishes the package.

The release workflow is `.github/workflows/release.yml`. It runs only for tags matching `v*`.

## One-time repository setup

Create a protected GitHub Environment named `npm-release`.

Recommended protection:

- restrict deployment branches and tags to release tags
- require an explicit reviewer before registry publication
- keep environment administrators limited
- prevent self-review where the organization policy supports it

Create a granular registry access token with publish-only access to the `dokion` package. Store it as the environment secret named `NPM_TOKEN`.

Do not add the token to repository variables, workflow files, local examples, issue comments, build logs, package files, or committed configuration.

## Authentication limitation

npm trusted publishing uses automatic OIDC exchange through npm CLI. Dokion does not use npm CLI because the repository contract requires Bun for JavaScript package operations.

The workflow therefore does not claim npm OIDC trusted publishing. It supplies the protected environment token directly to `bun publish` through the supported `NPM_CONFIG_TOKEN` environment variable. This is a recorded release-platform limitation, not hidden parity.

## Version preparation

The following versions must be identical:

- `package.json`
- `gemini-extension.json`
- Git tag without the leading `v`

Example sequence:

```bash
bun pm version 0.4.0 --no-git-tag-version
```

Update `gemini-extension.json` to the same version, run the full verification set, commit the version change, then create and push `v0.4.0`.

Never push a release tag from a commit that has not passed the normal branch CI.

## Release gates

The tag workflow repeats these checks from the tagged commit:

```bash
bun test
bun run typecheck
bun run validate:contracts
bun run build
bun run validate:distribution
bun run smoke:package
bunx @google/gemini-cli@0.51.0 extensions validate .
```

It then builds:

- Linux x64 baseline
- Linux ARM64
- macOS ARM64
- macOS x64
- Windows x64 baseline

The workflow creates SHA-256 checksums, a Bun-generated package tarball, and the compiled binaries before entering the protected `npm-release` environment.

## Publication behavior

Registry versions are immutable. On a workflow rerun, Dokion checks the registry with `bun info`. When the version already exists, package publication is skipped and the GitHub release assets are replaced with the verified artifacts from the tagged commit.

When the version does not exist, the workflow publishes the validated tarball with `bun publish`.

## Installation

Package installation:

```bash
bun add --global dokion
```

Repository-local installation:

```bash
bun add --dev dokion
```

Gemini CLI extension installation from GitHub:

```bash
gemini extensions install https://github.com/imMamdouhaboammar/dokion --ref v0.4.0
```

Installation does not choose, install, reorder, or enable playbook capabilities. `.dokion/playbook.json` remains the user's execution authority.

## Failure handling

Do not move or recreate a tag after publication.

When verification fails, fix the source, increment the version, and create a new tag. When registry publication succeeds but GitHub release creation fails, rerun the same workflow. Its registry check prevents a duplicate immutable version publish.
