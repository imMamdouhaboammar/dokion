# Dokion Support and Compatibility Matrix

## Purpose

This matrix separates what Dokion currently proves from what it only builds or packages. It is tied to the repository's current automated evidence and must be updated when the host matrix, adapter contracts, or distribution gates change.

This document does not assert general production readiness for Dokion or for a repository evaluated by Dokion.

## Claim vocabulary

| Status | Meaning |
| --- | --- |
| `TESTED` | The behavior runs in automated CI or a repeatable repository test on the named host and mode. |
| `PACKAGED` | The artifact or adapter is built and structurally validated, but the complete user flow is not executed on the named host. |
| `DEGRADED` | Dokion can run, but one or more enforcement guarantees are unavailable and must be recorded in state and reports. |
| `NOT YET PROVEN` | The repository has no current automated evidence for the complete claim. |

A surface may have more than one status. For example, an adapter may be `TESTED` for packaging and `DEGRADED` for runtime enforcement.

## Delivery modes

| Delivery surface | Current status | Evidence and boundary |
| --- | --- | --- |
| Package mode | `TESTED` on Ubuntu x64 | CI creates the exact Bun package archive, installs it into a clean Bun project, runs help, catalog validation, init, doctor, and tool listing. Native macOS and Windows package installation are `NOT YET PROVEN`. |
| Standalone binary mode, Linux x64 | `TESTED` | Ubuntu CI executes the compiled binary, validates help output, and runs the embedded catalog from a clean directory. |
| Standalone binary mode, Linux ARM64 | `PACKAGED` | Bun cross-compiles the artifact. Native ARM64 execution is `NOT YET PROVEN`. |
| Standalone binary mode, macOS ARM64 | `PACKAGED` | Bun cross-compiles the artifact. Native macOS execution is `NOT YET PROVEN`. |
| Standalone binary mode, macOS x64 | `PACKAGED` | Bun cross-compiles the artifact. Native macOS execution is `NOT YET PROVEN`. |
| Standalone binary mode, Windows x64 | `PACKAGED` | Bun cross-compiles the artifact. Native Windows execution is `NOT YET PROVEN`. |

## Agent adapters

| Agent surface | Discovery and packaging | Runtime guarantee status | Current boundary |
| --- | --- | --- | --- |
| Claude Code | `TESTED` by adapter contracts and plugin structure tests | Conditional | The playbook guard is tested. Native hook enforcement, subagent isolation, parallel writes, and worktree isolation are recorded only when explicit platform evidence is present. Missing evidence produces `DEGRADED` status. |
| Codex | `TESTED` by canonical skill and repository guidance contracts | `DEGRADED` | The authority model, digest checks, evidence gates, and recovery remain available. Native hook enforcement and native subagent isolation are unavailable, so `NO_HOOK_ENFORCEMENT` and `NO_SUBAGENT_ISOLATION` apply. |
| Gemini CLI | `TESTED` by the official extension validator and adapter contracts | `DEGRADED` | Extension packaging and namespaced commands are validated on Ubuntu. Native hook enforcement and native subagent isolation are unavailable. |
| Ordinary shell | `TESTED` for the CLI on Ubuntu x64 | `DEGRADED` | Core CLI behavior is available without agent packaging. Hook, subagent, and parallel writer guarantees are unavailable unless an external harness proves them. |

The adapter is not allowed to create authority. Every agent reads the same canonical hardening workflow and the same active `.dokion/playbook.json`.

## Host operating systems

| Host | Package mode | Native binary execution | Adapter integration | Current status |
| --- | --- | --- | --- | --- |
| Linux, Ubuntu x64 | `TESTED` | `TESTED` | Claude, Codex, and Gemini contracts are `TESTED` | This is the only current full CI host. |
| Linux ARM64 | `NOT YET PROVEN` | `PACKAGED` | `NOT YET PROVEN` | A native ARM64 host job is not in the current host matrix. |
| macOS ARM64 | `NOT YET PROVEN` | `PACKAGED` | `NOT YET PROVEN` | A native macOS host job is not in the current host matrix. |
| macOS x64 | `NOT YET PROVEN` | `PACKAGED` | `NOT YET PROVEN` | A native macOS x64 host job is not in the current host matrix. |
| Windows x64 | `NOT YET PROVEN` | `PACKAGED` | `NOT YET PROVEN` | A native Windows host job is not in the current host matrix. |

Cross-compilation proves artifact creation, not host compatibility. The planned Linux, macOS, and Windows host matrix must execute the runtime, parser, state recovery, command execution, path handling, package install, and native binary smoke flows before those rows become `TESTED`.

## Portable guarantees

These guarantees are intended to hold across every supported adapter when the declared workflow is executable:

- the active playbook remains the only execution authority
- stage and step order remain user-defined
- playbook digest mutation produces a terminal tainted run
- configured verification requires stored evidence
- state and reports remain resumable from disk
- completion claims remain qualified by commit, playbook, evidence, gates, coverage, and degradations

These guarantees depend on explicit platform support and may degrade:

- hook-based write prevention
- native subagent permission isolation
- isolated parallel writers
- harness-managed worktree isolation

When absent, Dokion records `NO_HOOK_ENFORCEMENT`, `NO_SUBAGENT_ISOLATION`, `NO_PARALLEL_WRITES`, or `NO_WORKTREE_ISOLATION`. A missing guarantee is not silently treated as present.

## Updating this matrix

A row may move to `TESTED` only when the repository contains repeatable evidence for that exact host, delivery mode, adapter, and flow. A passing cross-compile, schema check, or packaging validator cannot be used as evidence for native execution on another operating system.
