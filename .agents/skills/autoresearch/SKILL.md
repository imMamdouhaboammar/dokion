---
name: autoresearch
description: "Autonomous iteration loop: modify, verify, keep/discard against any metric"
version: 2.2.1
---

# Autoresearch — Autonomous Goal-directed Iteration

## Safety Invariants (all subcommands)
- Never push, publish, or deploy without explicit user approval.
- Bounded by default. Override with `Iterations: unlimited`.
- All results logged to `autoresearch/{subcommand}-{YYMMDD}-{HHMM}/` directory.
- Chain handoff via `handoff.json`. Evals reads `*-results.tsv`.
