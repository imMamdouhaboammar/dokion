# Dokion M5 Cross-Agent Adapter Plan

**Goal:** Ship one canonical Dokion hardening skill with thin packaging adapters for Claude Code, Codex, and Gemini CLI, while recording platform guarantees and degradations in state and reports.

**Rules:**

- The canonical hardening workflow is authored once under `skills/dokion-hardening/SKILL.md`.
- Adapters may translate discovery, packaging, commands, hooks, or context only.
- Adapters may never select, install, reorder, substitute, or enable playbook capabilities.
- Platform detection is conservative. A guarantee is recorded only when the runtime receives explicit evidence for it.
- Unknown or unavailable guarantees are stored as degradations, not silently treated as equivalent.

## Task 1: RED tests

- Add tests for explicit and inferred platform detection.
- Add tests that state initialization persists agent, version, platform profile, and degradations.
- Add structural tests for Claude, Codex, and Gemini adapter files.
- Add a test proving wrappers reference the canonical skill and do not contain a second workflow copy.

## Task 2: Platform profile

- Add `src/platform/platform-detector.ts`.
- Support `DOKION_AGENT` as the explicit authority.
- Infer Claude Code, Codex, and Gemini CLI from known environment markers.
- Support explicit guarantee markers for hooks, subagent isolation, parallel writes, and worktree isolation.
- Record missing guarantees with existing state degradation enums.

## Task 3: Runtime integration

- Extend state initialization with agent version, degradations, and platform profile.
- Detect the platform in `dokion init`, `dokion doctor`, and `ExecutionEngine.run()`.
- Preserve the original platform profile across resume.
- Render platform and degradation data in `HARDENING.md`.

## Task 4: Canonical skill and adapters

- Replace the incorrect generated Python skill with a TypeScript/Bun Dokion skill.
- Add `.claude-plugin/plugin.json` and a safe pre-command verification hook.
- Add a Codex `AGENTS.md` plus a thin `.agents/skills` wrapper.
- Add `gemini-extension.json`, `GEMINI.md`, and namespaced TOML commands.
- Keep all adapter commands declarative. Installation remains a user action.

## Task 5: Validation

- Run all Bun tests.
- Run typecheck, contract validation, and build.
- Verify each JSON manifest parses and each wrapper resolves the canonical source.
- Open and merge a PR only after CI is green.
