# Dokion Onboarding Guide: "Skills to Playbooks"

Welcome to Dokion! Dokion is **The Playbook Engine for AI Coding Agents**.

While single-task **Skills** handle immediate individual prompts, **Dokion Playbooks** connect skills into autonomous, multi-hour engineering pipelines with explicit write scopes, empirical test verification, and automatic Git rollback.

---

## 1. Quick Start in 60 Seconds

Install Dokion globally with Bun:

```bash
bun add --global dokion
```

In any software repository, initialize Dokion state:

```bash
dokion init
```

List available reference playbooks:

```bash
dokion playbooks list
```

Import a reference playbook (e.g. `superpowers` or `web-fullstack`):

```bash
dokion playbooks import --from superpowers
```

---

## 2. Preview the Execution Plan (Dry-Run)

Before writing any files or executing shell commands, preview the exact execution stages, sub-agent swarms, write permissions, and release gates:

```bash
dokion plan
```

---

## 3. Run Autopilot Execution

Run the active playbook with explicit user approval boundaries:

```bash
dokion run
# Or run in autonomous autopilot mode:
dokion autopilot
```

Dokion will:
1. Execute steps sequentially or in parallel swarms as specified in the playbook.
2. Capture pre-repair Git snapshots before write operations.
3. Record empirical build/test evidence logs.
4. Automatically restore the pre-repair snapshot if verification fails or output is tainted.

---

## 4. Audit, Status & Reports

Inspect execution state, normalized findings, and generated audit journals at any time:

```bash
dokion status
dokion findings
dokion report
```

Check the generated `HARDENING.md` for a complete, cryptographic journal of executed stages, findings, and evidence checksums.
