# ⚙️ Protocol 5: Zero-Setup Bun Native Orchestration Protocol

## 1. Overview
Zero-Setup Bun Native Orchestration mandates using Bun as the primary JavaScript/TypeScript runtime and package manager across all local projects and tools for maximum execution speed and zero friction.

## 2. Core Operational Rules
1. **Bun Mandate**:
   - Use `bun` for package installation (`bun install`), script execution (`bun run`), and package execution (`bun x`).
   - Do not use npm or yarn unless explicitly exempted by system policy.

2. **Background Process Management**:
   - Launch long-running development servers or file watchers using `run_command` with proper async parameters.
   - Use `manage_task` to monitor status or terminate background jobs without blocking main execution loops.

3. **Hermetic Environment Verification**:
   - Run tests and verifications using `bun test` or `bun x vitest` to confirm runtime health before marking tasks as complete.
   - Maintain zero dependency conflicts in `bun.lock`.
