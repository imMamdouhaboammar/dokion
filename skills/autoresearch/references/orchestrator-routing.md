# Orchestrator Routing

## Goal Archetypes

| Archetype | Trigger Keywords | Mode | Preset Pipeline |
|---|---|---|---|
| `ship-ready` | ship, release, deploy, publish, production-ready, merge | loop | probe, debug, fix, regression, ship |
| `optimize-metric` | improve, optimize, increase, reduce, faster, smaller, coverage, score | loop | plan, (classic loop), evals |
| `fix-broken` | fix, broken, failing, error, crash, bug, can't run, tests fail | loop | debug, fix, regression |
| `harden` | security, vulnerability, audit, OWASP, CVE, harden, lock down | loop | security, fix, security |
| `build-feature` | build, add, implement, create, new feature, acceptance test | loop | (acceptance-test derive), debug, fix, regression |
| `explore` | understand, explore, investigate, what does, how does, edge cases | loop | probe, scenario, plan |
| `document` | document, wiki, generate docs, explain codebase, write guide | dispatch | learn |
| `what-to-build` | what should I build, ideas, improvements, PRD, roadmap | dispatch | improve |
| `decide-design` | which approach, compare options, design decision, architecture choice | dispatch | reason |

Keyword matching is fuzzy — partial matches and synonyms qualify. When a goal matches multiple archetypes, prefer the more specific one (fix-broken over explore; ship-ready over fix-broken if "ship" is explicit). When ambiguous, show the top two candidates in the upfront confirm and let the user choose.

## Router Decision Table

| State Signal | Source | Next Hop |
|---|---|---|
| `errors > 0` in last handoff | handoff.json `findings` | `fix` |
| regression verdict `UNSTABLE` | handoff.json `verdict` | `regression` |
| `untested_gaps` flagged | handoff.json or units output | `debug` |
| `pending_verify` true | orchestrator-state.json | `verify` (fresh independent acceptance check) |
| predicate met | Success predicate command exit/output | `DONE` (exit loop) |
| hop outcome `blocked` or `failed`, no retry route | orchestrator-state.json | `BLOCKED` (checkpoint + stop) |
| plateau detected | plateau calculation | `PLATEAU` (stop + report) |
| archetype pipeline has remaining steps | preset pipeline sequence | next preset step |
| all preset steps exhausted, predicate not met | — | `regression` (convergence re-check) |
