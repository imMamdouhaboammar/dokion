# Dokion Onboarding Guide

Dokion is an execution control layer for user-authored engineering Playbooks

A capability supplies instructions or an executable tool. A Playbook declares how selected capabilities may run, in which order, with which permissions, approvals, evidence, and stop conditions

## 1. Install

```bash
bun add --global dokion@0.3.0
```

Dokion currently requires Bun `1.3.14` or later

## 2. Initialize Dokion-owned state

```bash
dokion init
```

Initialization creates Dokion-owned state directories and `HARDENING.md`. It does not create or activate `.dokion/playbook.json`

## 3. Create or copy the active Playbook

Choose and review a Playbook yourself, then copy the exact approved file to the sole execution-authority path

```bash
mkdir -p .dokion
cp /path/to/reviewed-playbook.json .dokion/playbook.json
```

The source path above is intentionally user-controlled. Do not copy a Playbook that you have not reviewed for capabilities, commands, permissions, approvals, and verification gates

A source checkout can list its included reference Playbooks with:

```bash
dokion playbooks list
```

`playbooks import --from` currently expects a filesystem source path. Do not pass a built-in name such as `superpowers` unless a real directory with that name exists

Dokion does not select or activate a different Playbook automatically

## 4. Inspect prerequisites

```bash
dokion inspect
dokion doctor
```

These commands inspect the repository and report local capability availability without granting execution authority

## 5. Validate the active Playbook

```bash
dokion validate
```

Validation checks the active Playbook, repository contracts, capability references, permissions, and dependencies

## 6. Preview declared execution

```bash
dokion plan
```

The plan shows declared stages, step order, permissions, approvals, and gates. It does not execute commands

## 7. Execute

```bash
dokion run
```

Execution follows `.dokion/playbook.json` through the production `ExecutionEngine`

Dokion records state, findings, command evidence, approvals, and supported repair transactions. Repository writes remain bounded by the active Playbook

Use bounded autopilot only when the active Playbook already contains the intended authority:

```bash
dokion autopilot
```

## 8. Inspect the result

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
