# Official GitHub Action Design Specification for Dokion

## Overview

This document specifies the design for the official Dokion GitHub Action (`action.yml`). The action provides a zero-setup, composite GitHub Action that runs Dokion playbooks, verifies software hardening contracts, records evidence, and publishes markdown hardening reports directly to GitHub CI Step Summaries (`$GITHUB_STEP_SUMMARY`).

## User Value & Goals

1. **Zero-Setup CI Security & Quality Guard:** Enable developers to add Dokion to any repository with a simple `uses: imMamdouhaboammar/dokion@v0.3.0` step.
2. **First-Class CI Feedback:** Render `HARDENING.md` and evidence findings in the GitHub Actions Job Summary tab for instant visual feedback.
3. **Fail-Closed Governance:** Automatically block PRs if playbooks detect unverified repairs, unsafe mutations, or failing release gates.
4. **Flexible Configuration:** Support custom playbooks (`.dokion/playbook.json`), specific Dokion versions, and configurable failure policies.

## Composite Action Contract (`action.yml`)

### Inputs
| Input | Description | Default | Required |
| --- | --- | --- | --- |
| `playbook` | Path to active playbook file | `.dokion/playbook.json` | `false` |
| `dokion-version` | Version of `dokion` package to run | `latest` | `false` |
| `working-directory` | Working directory for execution | `.` | `false` |
| `fail-on-findings` | Fail step if findings or verification errors exist | `true` | `false` |
| `create-summary` | Write `HARDENING.md` to `$GITHUB_STEP_SUMMARY` | `true` | `false` |

### Outputs
| Output | Description |
| --- | --- |
| `status` | Execution status (`SUCCEEDED`, `FAILED`, `PARTIAL`) |
| `exit-code` | Numerical exit code from `dokion run` |
| `report-path` | Path to generated `HARDENING.md` file |
