# Registry Protocol v1 Verification Record

This record separates observed verification evidence from pending review work for PR #50.

## RED evidence

The first protocol contract run intentionally failed because the six v1 schemas and their fixtures did not exist. The same run also exposed stale Community Hub claims in the README, agent adapters, Gemini command surface, CLI parser, runtime switch, and built-in command metadata.

Those failures established the migration boundary before implementation.

## Implemented contracts

The branch now contains:

- `dokion.registry-root.v1`
- `dokion.registry-index.v1`
- `dokion.package-manifest.v1`
- `dokion.registry-config.v1`
- `dokion.playbooks-lock.v1`
- `dokion.provenance.v1`
- shared Registry protocol definitions
- six valid fixtures
- six negative refusal fixtures
- AJV and Python conformance checks

## Negative controls

The fixtures prove refusal of:

- Registry activation authority
- mutable Git revisions
- package path traversal
- credentials embedded in Registry source URLs
- floating lockfile versions
- generic `verified` provenance claims

## Observed GREEN evidence

GitHub Actions repair run 737 completed these checks successfully before committing the exact built-in manifest correction:

- focused Registry and CLI contracts
- root JSON Schema conformance
- Registry protocol JSON Schema conformance
- complete Bun test suite
- TypeScript typecheck
- production build

The run reported 448 passing Bun tests across 123 files after the final README contract correction.

The repair commit restored the standard read-only CI workflow and changed only:

- `.github/workflows/ci.yml`, restored from `main`
- `dokion.json`, replacing stale Hub usage and purpose text with the planned Registry status

## Pending gates

This record does not claim final PR completion. The following remain required:

- standard CI on the committed branch head
- release binary smoke checks
- packed distribution validation
- clean Bun installation smoke test
- Gemini extension validation
- tracked-mutation and credential-residue check
- CodeRabbit review and resolution of critical or major findings
- scoped security review when an actual Codex Security execution environment is available

The PR must remain draft until the standard CI and review gates are complete.
