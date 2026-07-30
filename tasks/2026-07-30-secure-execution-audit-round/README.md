# Secure Execution and Audit Round Tasks

Plan: `docs/superpowers/plans/2026-07-30-secure-execution-audit-round.md`

## Waves

- Wave A: task-01, task-02, task-03, task-05, task-06, task-07, task-08, task-09, task-10, task-12, task-13, task-14, task-15, task-18, task-19, task-20, task-21, task-22
- Wave B: task-04, task-11, task-16, task-23
- Wave C: task-17, task-24

Each task runs in an isolated git worktree. Subagents do not commit. The Orchestrator reviews, verifies, commits, and cherry-picks each accepted task.
