# Dokion Architecture Decision Records

Architecture Decision Records preserve decisions that materially constrain Dokion's security model, runtime, data integrity, portability, distribution, or public contracts.

An ADR explains why a constraint exists, not only what the current code does. Source code and documentation may evolve, but an accepted decision remains historical evidence until another ADR explicitly supersedes it.

## Status vocabulary

- **Proposed:** Under review and not authoritative.
- **Accepted:** Authoritative for new work and maintenance.
- **Superseded:** Replaced by a named later ADR; retained as history.
- **Deprecated:** Still present for compatibility but should not guide new design.
- **Rejected:** Considered and deliberately not adopted.

## Decision index

| ADR | Decision | Status | Effective date |
| --- | --- | --- | --- |
| [0001](0001-authority-model.md) | The user-approved playbook is the sole execution authority | Accepted | 2026-07-25 |
| [0002](0002-bun-only-runtime.md) | Dokion repository runtime and package operations are Bun-only | Accepted | 2026-07-25 |

## When an ADR is required

Create an ADR before implementing a change that would alter any of the following:

- execution authority, precedence, approvals, permissions, or stop behavior
- state, journal, evidence, finding, repair, or audit integrity
- capability provenance, installation boundaries, or trust assumptions
- supported runtimes, package managers, operating systems, or agent adapters
- public CLI, schema, module, report, package, binary, or release contracts
- security guarantees, acknowledged degradations, or production-readiness criteria

Routine implementation detail, test additions, and refactoring inside an accepted boundary do not require a new ADR.

## Authoring process

1. Choose the next unused four-digit number. Numbers are never recycled.
2. Copy the required sections: status, context, decision, consequences, alternatives, and amendment rules.
3. State the exact invariant and the surfaces it constrains.
4. Identify costs and weakened flexibility, not only benefits.
5. Add the proposed ADR to this index.
6. Obtain review before dependent implementation is merged.
7. Change the status to Accepted only when the decision is approved.
8. Link implementation plans, tests, or migration work that prove the decision.

## Amendment policy

Accepted ADRs are append-only historical records. Typographical fixes and broken-link repairs are permitted only when they do not change meaning.

A material change requires a new superseding ADR. The newer record must name the ADR it supersedes, explain the migration and compatibility impact, and update this index. The older ADR remains in the repository with status `Superseded by ADR-NNNN`.

No source file, playbook, agent instruction, release workflow, or direct implementation shortcut may silently override an Accepted ADR.
