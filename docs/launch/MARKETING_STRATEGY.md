# Dokion Launch and Community Strategy

This document is a pre-launch control document, not approved public campaign copy

Dokion must not launch from broad category language alone. Public wording must be tied to the exact release candidate, generated product surface, reproducible fixtures, and completed review evidence

## Current positioning

| Element | Current decision |
| :--- | :--- |
| Product | Dokion |
| Category | Agent Execution Control |
| Initial wedge | Software hardening and release assurance |
| Current supported story | User-authored Playbooks executed with declared order, permissions, approvals, state, findings, and evidence |
| First planned guided journey | Secure Release for supported Bun and Node TypeScript repositories |
| Primary audience | Engineers and maintainers who need a governed execution contract around coding-agent work |

## Approved current description

Dokion is an execution control layer for user-authored engineering Playbooks

It preserves declared order, permissions, approvals, state, evidence, verification boundaries, and repair decisions without selecting capabilities for the user

## Claims that require release evidence

Do not publish any of the following until the exact claim is present in the generated product surface and proven by maintained acceptance fixtures:

- Universal subagent isolation
- General parallel-agent coordination
- Independent test and build re-verification through `dokion verify`
- Reversal of every command or external side effect
- Secure Release guided first run
- Exact proposal acceptance and activation
- Versioned Run Trace exports
- Registry installation, activation, publishing, ratings, or usage metrics
- Support for an agent platform based only on generic instruction-file compatibility

## Launch gate

Public launch copy is approved only when all of these are true for the same commit:

1. The product surface is generated and has no uncommitted diff
2. Every documented command parses and runs through the packaged CLI
3. The supported first journey passes clean-install positive and negative fixtures
4. Required test, typecheck, contract, build, distribution, and package-smoke checks pass
5. The GitHub Action passes against the canonical `.dokion/playbook.json` authority path
6. CodeRabbit has completed and every valid critical or major finding is resolved
7. Security-sensitive command, activation, archive, HTML, and workflow changes have a completed security review
8. Documentation labels implemented, planned, experimental, unavailable, and unproven behavior explicitly
9. External adoption results are real, consented, and reproducible from sanitized records

## Launch narrative after the gate

The first release narrative should demonstrate one repository journey rather than describe a general orchestration platform

Recommended structure:

1. Show the active Playbook and exact authority
2. Show the proposed stages, commands, permissions, and approvals
3. Execute one passing or accurately blocked run
4. Show findings and evidence produced by actual commands
5. Show the qualified readiness decision and limitations
6. Link the result to the exact commit and release artifact

## Channel policy

Hacker News, Reddit, X, Product Hunt, and community posts must use the same generated status source

No channel receives stronger wording than the README or release truth report

Screenshots and terminal recordings must come from a reproducible fixture. Do not use mocked success screens, fabricated repository counts, placeholder metrics, or manually edited evidence

## Current launch state

The broad public launch is on hold while Issue #54 completes the truthful first journey, independent verification contract, Run Trace, safe authoring boundary, deployed documentation, and external validation

Until those gates pass, communication should focus on engineering progress, authority invariants, validated Registry infrastructure, and exact current limitations
