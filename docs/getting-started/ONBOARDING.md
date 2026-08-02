# Dokion Onboarding Guide

Dokion is an execution control layer for user-authored engineering Playbooks

A capability supplies instructions or an executable tool. A Playbook declares how selected capabilities may run, in which order, with which permissions, approvals, evidence, and stop conditions

## 1. Install

```bash
bun add --global dokion@0.3.0
```

Dokion currently requires Bun `1.3.14` or later

## 2. Initialize the repository

```bash
dokion init
```

Initialization creates Dokion-owned state and the canonical active authority path

```text
.dokion/playbook.json
```

Review this file before proceeding. Dokion does not select or activate a different Playbook automatically

## 3. Inspect prerequisites

```bash
dokion inspect
dokion doctor
```

These commands inspect the repository and report local capability availability without granting execution authority

## 4. Validate the active Playbook

```bash
dokion validate
```

Validation checks the Playbook, repository contracts, capability references, permissions, and dependencies

Reference Playbooks can be listed with:

```bash
dokion playbooks list
```

`playbooks import --from` currently expects a filesystem source path. Do not pass a built-in name such as `superpowers` unless a real directory with that name exists

## 5. Preview declared execution

```bash
dokion plan
```

The plan shows declared stages, step order, permissions, approvals, and gates. It does not execute commands

## 6. Execute

```bash
dokion run
```

Execution follows `.dokion/playbook.json` through the production `ExecutionEngine`

Dokion records state, findings, command evidence, approvals, and supported repair transactions. Repository writes remain bounded by the active Playbook

Use bounded autopilot only when the active Playbook already contains the intended authority:

```bash
dokion autopilot
```

## 7. Inspect the result

```bash
dokion status
dokion findings
dokion report
```

`HARDENING.md` is a human-readable report derived from persisted Dokion state. Treat its readiness language as scoped to the active Playbook, recorded commit, completed steps, and declared coverage

## Current limitations

- `dokion verify` currently validates repository and Playbook contracts rather than independently re-running declared build and test gates
- The Secure Release guided first run is planned, not implemented
- The versioned Run Trace export is planned, not implemented
- Registry pull verifies and caches packages but does not install or activate them
- Rollback applies to supported repair transactions with captured snapshots, not every external side effect

See [`../../README.md`](../../README.md), [`../compatibility.md`](../compatibility.md), and [Issue #54](https://github.com/imMamdouhaboammar/dokion/issues/54) for the current adoption program
