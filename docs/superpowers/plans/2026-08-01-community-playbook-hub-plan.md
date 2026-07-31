# Dokion Community Playbook Hub & Registry — Implementation Plan

**Plan Date:** 2026-08-01  
**Target:** Full Implementation & Test Coverage  

---

## Proposed Tasks

### Task 1: Registry Type System & Data Contracts
- Create `src/registry/types.ts`: Define `HubPlaybookPackage`, `PublisherProfile`, `RatingRecord`, `LeaderboardEntry`, `ForkLineage`.

### Task 2: Registry Client & Hub Engine
- Create `src/registry/hub.ts`: Index management, package fetching, local cache sync, search query parsing.

### Task 3: Telemetry Engine & Privacy Client
- Create `src/telemetry/types.ts`, `src/telemetry/client.ts`, and `src/telemetry/index.ts`.
- Implement opt-in check (`DOKION_TELEMETRY_DISABLED`), anonymized session ID generation, local event spooling in `.dokion/telemetry/`.

### Task 4: Leaderboard & Dynamic Ranking Engine
- Create `src/registry/leaderboard.ts`: Calculate composite ranking scores, category filtering, verified publisher weighting.

### Task 5: Forking, Merging & Custom Adaptation Engine
- Create `src/registry/fork-merge.ts`: Lineage tracking (`parent_digest`), diff-based merging, SHA-256 re-hashing.

### Task 6: CLI Handlers & Command Registry Integration
- Create `src/cli/handlers/hub.ts`: Handlers for `search`, `pull`, `publish`, `leaderboard`, `rate`, `fork`, `merge`.
- Register commands in `src/cli/command-registry.ts`, `src/cli/parser.ts`, `src/cli/types.ts`, `src/cli.ts`.
- Update `dokion.json` and `SPEC.md`.
- Create Gemini command file `commands/dokion/hub.toml`.

### Task 7: Canonical Agent Skill Pack & Adapters
- Create canonical skill: `skills/dokion-playbook-hub/SKILL.md`.
- Create Claude Code adapter: `.claude/skills/dokion-playbook-hub/SKILL.md`.
- Create Codex adapter: `.agents/skills/dokion-playbook-hub/SKILL.md`.

### Task 8: Unit & Integration Tests
- Create `tests/registry/hub.test.ts`.
- Create `tests/telemetry/telemetry.test.ts`.
- Update `tests/contracts/cli-parity.test.ts` and `tests/cli/command-registry-runtime.test.ts`.
- Verify all tests pass 100% green.
