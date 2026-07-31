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

## Dispatch (bare `/autoresearch`)

Parse the invocation in this order:

| Condition | Mode |
|---|---|
| `Metric:` or `Verify:` present | **Classic** — existing metric loop, unchanged |
| Free-form natural-language goal, no metric/verify | **Orchestrator** — see Orchestrator section |
| Nothing | **Setup wizard** — interactive config builder |
| `--classic` flag | Force Classic regardless of goal text |
| `--auto` flag | Force Orchestrator regardless of goal text |

Print a banner on every invocation: `[autoresearch] mode: classic | orchestrator | wizard`.
