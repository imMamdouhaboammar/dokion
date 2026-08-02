# Contributing to Dokion

Dokion is a security-sensitive user-directed hardening runtime. Contributions must preserve the user-authority model, evidence requirements, exact rollback behavior, explicit platform degradations, and Bun-only repository workflow.

## Read before changing code

Start with:

- [`SPEC.md`](SPEC.md)
- [`AGENTS.md`](AGENTS.md)
- [`SECURITY.md`](SECURITY.md)
- [`docs/adr/README.md`](docs/adr/README.md)
- [`docs/architecture/bounded-autopilot.md`](docs/architecture/bounded-autopilot.md)
- [`docs/architecture/production-readiness.md`](docs/architecture/production-readiness.md)
- [`docs/engineering/commit-policy.md`](docs/engineering/commit-policy.md)

The active `.dokion/playbook.json` is user-owned execution authority. A contribution must not add implicit capability selection, installation, substitution, reordering, scope expansion, gate weakening, or inferred approval.

## Development environment

Requirements:

- Bun 1.3.14 or newer
- Git
- Python 3 with `jsonschema` for independent schema conformance
- system `tar` for package archive inspection

Install dependencies with:

```bash
bun install --frozen-lockfile
python3 -m pip install jsonschema
```

Do not introduce npm, yarn, pnpm, alternate JavaScript lockfiles, or a second repository package-operation path. See ADR-0002.

## Change workflow

1. Start from current `main` on an isolated feature branch or worktree.
2. Select one backlog item, defect, or independently reviewable behavior.
3. Write the smallest targeted failing test that proves the missing behavior.
4. Run it and confirm the failure is caused by the missing behavior rather than a syntax or fixture error.
5. Implement the smallest coherent change that makes the test pass.
6. Run the targeted test, related tests, typecheck, and the required full phase gate.
7. Review authority, permissions, paths, environment access, evidence, secrets, rollback, adapters, and release effects.
8. Open a focused pull request with RED and GREEN evidence.
9. Use Squash merge when a pull request contains temporary test or repair history so one reviewable item becomes one main-branch commit.

Detailed boundaries, exception rules, and review criteria are defined in [`docs/engineering/commit-policy.md`](docs/engineering/commit-policy.md).

## Required verification

For every source, schema, contract, runtime, or documentation-contract change:

```bash
bun run test
bun run typecheck
bun run validate:contracts
bun run build
```

For distribution, adapter, package, binary, or release changes also run:

```bash
bun run validate:distribution
bun run smoke:package
bun run scripts/build-release.ts
bunx @google/gemini-cli@0.51.0 extensions validate .
```

A passing targeted test is not a substitute for the complete required gate.

## Test expectations

- Test behavior through public or stable internal interfaces.
- Prove the RED state before writing production behavior.
- Use real files and processes when the behavior depends on filesystem, Git, command, package, or binary semantics.
- Keep fixtures deterministic and bounded.
- Add a regression test for every repair.
- Do not make a test pass through suppression, skipped tests, weakened assertions, deleted coverage, or unrelated configuration changes.
- Preserve Windows, macOS, Linux, package, binary, and adapter distinctions when relevant.

## Security-sensitive changes

Changes involving commands, environment variables, paths, symlinks, filesystem writes, repair validation, state, events, evidence, capability provenance, adapters, workflows, dependencies, secrets, packages, binaries, publication, or release require explicit security review in the pull request.

Use the repository threat model to describe:

- attacker control
- trust boundary crossed
- protected asset
- existing mitigation
- new invariant or regression test
- residual risk and platform degradation

Do not include real credentials, private repository content, or private local paths in tests, logs, fixtures, reports, or pull request text.

## Documentation and ADRs

Update documentation in the same change when behavior or a public contract changes. Do not describe planned behavior as implemented.

A material change to authority, state integrity, capability trust, supported runtimes, public schemas, adapters, distribution, or readiness criteria requires an ADR. Accepted ADRs are not rewritten to change meaning; create a superseding ADR.

## Pull request checklist

A pull request is ready for review only when:

- the scope is one coherent review unit
- the RED failure and final verification evidence are recorded
- every changed file is necessary for the stated behavior
- unrelated formatting and generated residue are absent
- authority and permission boundaries remain explicit
- secrets and private paths are absent
- tests, typecheck, contracts, build, and applicable distribution gates pass
- documentation and progress records match the final head
- the proposed merge method leaves one coherent main-branch commit

## Reporting security issues

Follow [`SECURITY.md`](SECURITY.md). Do not disclose an unpatched vulnerability in a public issue or pull request.
