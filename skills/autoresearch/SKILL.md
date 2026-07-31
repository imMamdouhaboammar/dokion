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

## Subcommands

| Command | Does | Default Iterations |
|---|---|---|
| `/autoresearch` | Iterate against a metric: modify → verify → keep/discard | 25 |
| `/autoresearch:plan` | Convert a goal into validated Scope, Metric, Verify config | N/A |
| `/autoresearch:debug` | Hunt bugs: hypothesize → test → falsify → repeat | 15 |
| `/autoresearch:fix` | Crush errors one-by-one until zero remain | 20 |
| `/autoresearch:security` | STRIDE + OWASP audit with red-team personas | 15 |
| `/autoresearch:ship` | Ship through 8 phases: checklist → dry-run → deploy → verify | N/A |
| `/autoresearch:scenario` | Generate edge cases across 12 dimensions | 20 |
| `/autoresearch:predict` | 5 expert personas debate before implementation | N/A |
| `/autoresearch:learn` | Scout codebase → generate docs or wiki → validate → fix loop | 10 |
| `/autoresearch:reason` | Adversarial debate with blind judges until convergence | 8 |
| `/autoresearch:probe` | 8 personas interrogate requirements until saturation | 15 |
| `/autoresearch:improve` | Research ICP challenges, discover improvements, generate PRDs | 15 |
| `/autoresearch:evals` | Analyze iteration results: trends, plateaus, regressions | N/A |
| `/autoresearch:regression` | Regression stability gate: baseline vs candidate, verdict STABLE/UNSTABLE | N/A |

## Universal Flags

| Flag | Applies To | Purpose |
|---|---|---|
| `Iterations: N` | All looping | Set iteration count |
| `Iterations: unlimited` | All looping | Opt-in unbounded |
| `--evals` | All looping | Mid-loop checkpoints + final summary |
| `--evals-interval N` | All looping | Override checkpoint frequency |
| `--chain <targets>` | All | Sequential handoff after completion |
| `--<subcommand>` | All | Shorthand for `--chain <subcommand>` |
| `--dry-run` | Orchestrator | Print derived config + planned pipeline; no execution |
| `--max-cycles N` | Orchestrator | Hard ceiling on orchestration cycles (default 50) |
| `--classic` | Bare `/autoresearch` | Force Classic metric-loop mode |
| `--auto` | Bare `/autoresearch` | Force Orchestrator mode |

## Orchestrator

Activated when a plain-language goal is given without `Metric:`/`Verify:`. Classifies the goal into a **Goal archetype** — see `references/orchestrator-routing.md` for the archetype table and router decision table.

**Two modes based on archetype:**
- **Orchestration loop** — predicate-bearing archetypes (ship-ready, optimize-metric, fix-broken, harden, build-feature, explore). Goal has a mechanical Success predicate; the loop runs until that predicate is met.
- **Single-pass dispatch** — subjective/terminal archetypes (document, what-to-build, decide-design). Routes once to the fitting subcommand (learn / improve / reason), lets it self-terminate, then reports. No loop, no Plateau, no ship gate.

### Orchestration Loop Steps

1. **Classify** — archetype label + mode.
2. **Derive predicate** — concrete Success predicate: exact shell command + expected output.
3. **Confirm** — archetype, mode, concrete predicate (command + expected output).
4. **Round-0 dry-run** — prove the predicate command runs and returns a value; safety-screen every derived command via `screen-cmd`.
5. **Loop** until predicate satisfied:
   a. Assess state via cheap signals (failing tests, error counts).
   b. Route to next subcommand.
   c. Run subcommand (inner loop).
   d. Keep changes that improve metric/reduce errors; rollback regressed changes.
6. **Stop conditions**: Predicate met (100% success), Plateau detected, Ceiling reached, or Blocked.
