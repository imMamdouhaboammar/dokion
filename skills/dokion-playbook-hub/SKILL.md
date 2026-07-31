---
name: dokion-playbook-hub
description: Interact with GitHub Native Decentralized Community Playbook Hub, Registry, and Leaderboard to search, pull, fork, publish, and track community playbooks.
---

# Dokion Community Playbook Hub & Registry — Agent Skill

Use this skill when searching for community playbooks, pulling verified community playbooks, viewing leaderboards, or publishing playbooks to the GitHub Native Decentralized Registry.

## Key Capabilities

1. **Search Community Playbooks**:
   ```bash
   dokion hub search --query "ui-review" --category "ui-ux"
   ```

2. **Pull Verified Community Playbook**:
   ```bash
   dokion hub pull amElnagdy/ui-review-loop
   ```
   *Pulls community playbook to inert `.dokion/playbook.proposed.json` with SHA-256 verification and anonymous telemetry logging.*

3. **View Community Leaderboard**:
   ```bash
   dokion hub leaderboard --category "ui-ux"
   ```

4. **Fork Community Playbook**:
   ```bash
   dokion hub fork amElnagdy/ui-review-loop --author "developer"
   ```

## Authority Invariants
- Pulled community playbooks **NEVER** overwrite `.dokion/playbook.json` automatically. They are written to `.dokion/playbook.proposed.json` until explicitly activated by the user.
