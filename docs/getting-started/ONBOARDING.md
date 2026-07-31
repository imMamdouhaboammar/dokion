# Dokion Getting Started & Onboarding Guide

Welcome to Dokion! Dokion is an explicit, bounded software-hardening runtime.

## 1. Quick Start
Select and activate a playbook for your project:

```bash
dokion playbooks list
dokion playbook proposal web-fullstack
dokion playbook activate .dokion/playbook.json
```

## 2. Dry-Run & Planning
Inspect the execution plan before writing any files:

```bash
dokion plan
```

## 3. Run Autopilot
Execute bounded hardening with deterministic approval boundaries:

```bash
dokion autopilot
```

## 4. Audit & Verification
Verify state journals, evidence checksums, and promotion readiness:

```bash
dokion verify
dokion audit
```
