# Dokion Security Policy

## Supported versions

Dokion is under active pre-1.0 development. Security fixes are applied to the latest supported release and the current `main` branch. Older versions may be referenced for investigation, but maintainers do not promise backports unless a security advisory says otherwise.

| Version | Supported |
| --- | --- |
| Latest published version | Yes |
| Current `main` branch | Yes |
| Older published versions | Case by case |

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue, pull request, discussion, commit message, or generated Dokion report before maintainers have assessed it.

Preferred reporting path:

1. Open the repository **Security** tab.
2. Use **Report a vulnerability** to create a private GitHub Security Advisory when that option is available.
3. Include the affected version or commit, operating system, agent surface, package or binary mode, prerequisites, impact, reproduction steps, and any minimal proof of concept.
4. Remove credentials, private repository contents, access tokens, and personal data from the report.

When private vulnerability reporting is unavailable, contact the repository owner through a private channel listed on the maintainer's GitHub profile. Do not fall back to a public issue for an unpatched vulnerability.

## What to report

Security-relevant reports include, but are not limited to:

- execution of an undeclared capability or command
- bypass of playbook digest, approval, permission, write-scope, retry, stop, or release-gate rules
- prompt injection that changes authority or execution behavior
- command injection, argument injection, unsafe environment inheritance, or process escape
- path traversal, symlink escape, repository-root confusion, or out-of-scope writes
- repair validation or rollback failures that accept a suppressed or incomplete fix
- state, event, evidence, approval, capability-lock, or report tampering that is not detected
- secret leakage through logs, evidence, state, reports, packages, binaries, or release artifacts
- compromised package, binary, adapter, workflow, or release provenance
- cross-agent degradation that is hidden or incorrectly reported as a stronger guarantee
- denial of service that can corrupt state, lose evidence, or leave an unsafe child process running

A scanner warning without a demonstrated Dokion-relevant security impact may still be useful, but include the trust boundary and attacker control needed to make the issue exploitable.

## Response process

Maintainers will aim to:

1. acknowledge receipt and preserve the report privately
2. reproduce and classify the issue against the repository threat model
3. identify affected versions, surfaces, and required mitigations
4. prepare regression tests before or with the fix
5. verify package, binary, adapter, and release consequences where applicable
6. coordinate disclosure after a fix or mitigation is available

Timelines depend on severity, reproducibility, release impact, and maintainer availability. Acknowledgement is not confirmation that a reported issue is valid.

## Disclosure and credit

Coordinated disclosure is preferred. Credit will be offered when requested and when publication does not expose private data or conflict with the reporter's preference.

## Security model and scope

The repository-scoped threat model is maintained at [`docs/security/threat-model.md`](docs/security/threat-model.md). It defines protected assets, trust boundaries, attacker-controlled inputs, security invariants, existing mitigations, out-of-scope stories, and severity calibration.

The authority model is recorded in [`docs/adr/0001-authority-model.md`](docs/adr/0001-authority-model.md). The runtime and package-operation decision is recorded in [`docs/adr/0002-bun-only-runtime.md`](docs/adr/0002-bun-only-runtime.md).

## Safe research expectations

Use repositories and systems you own or are explicitly authorized to test. Do not publish secrets, access unrelated data, disrupt third-party services, or test against another user's private repository without permission.

Dokion is a local developer tool, not a hosted security service. Reports about third-party scanners, agents, registries, or repositories should identify the Dokion-specific boundary or integration behavior involved.
