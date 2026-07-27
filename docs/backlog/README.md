# Dokion Delivery Backlog

## Purpose

This directory is the execution map from the current runtime baseline to a product that can be promoted honestly and then matured to production grade.

Dokion is a bounded hardening runtime with two supported playbook sources:

1. Curated built-in playbooks shipped and maintained by Dokion developers.
2. Custom playbooks authored or adapted by the user.

Both sources remain inert until the user explicitly selects and activates a playbook. The active `.dokion/playbook.json` remains the sole execution authority.

## Source-of-truth hierarchy

1. `SPEC.md` defines product semantics and authority boundaries.
2. `docs/architecture/` defines normative safety and readiness rules.
3. `docs/backlog/promotion-readiness.md` defines the public promotion gate.
4. The workstream backlogs in this directory define deliverables and acceptance criteria.
5. Root `tasks.md` is the active implementation tracker.
6. `docs/progress/production-backlog-progress.md` records merged evidence.

The older 100-item plan remains a useful engineering inventory. It is not a commit quota and must not force artificial commit splitting. This directory is the operational roadmap.

## Delivery stages

| Stage | Meaning | Permitted claim |
| --- | --- | --- |
| Internal alpha | Core flows work on controlled fixtures and developer machines. | Internal testing only. |
| Public beta | The promotion gate passes on the exact release candidate. | Bounded hardening runtime in public beta. |
| Production grade | Every production proof lane and supported-surface gate passes. | Qualified production-grade claim for the named release and surfaces. |

## Workstreams

- Core runtime and bounded autopilot
- Built-in and custom playbook library
- Capability provenance and module lifecycle
- State integrity, recovery, and secure execution
- Evidence, audit, reporting, and readiness
- Product experience, adapters, distribution, and launch operations

## Execution rules

- Bun is mandatory for package operations and repository scripts.
- Every behavior change starts with a failing test.
- Each commit carries one independently reviewable behavior and is pushed after verification.
- No task may expand authority beyond the active playbook and recorded approvals.
- Generated proposals and recommendations remain inert.
- Secrets, credentials, private paths, and raw environment values never enter repository artifacts.
- A task is complete only when code, tests, contracts, documentation, and rollback behavior agree.
