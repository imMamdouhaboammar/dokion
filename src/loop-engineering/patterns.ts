export interface LoopPatternTemplate {
  id: string;
  name: string;
  description: string;
  playbookTemplate: Record<string, unknown>;
  budgetTemplate: string;
}

export class LoopPatterns {
  public static getPattern(patternId: string): LoopPatternTemplate | undefined {
    const patterns: Record<string, LoopPatternTemplate> = {
      "daily-triage": {
        id: "daily-triage",
        name: "Daily Triage & Issue Remediation",
        description: "Systematically inspect issues/PRs, prioritize defect findings, apply bounded repairs with TDD, and verify clean status.",
        playbookTemplate: {
          $schema: "https://dokion.dev/schemas/user-playbook.v1.schema.json",
          schema_version: "1.0.0",
          pattern: "daily-triage",
          name: "Daily Triage Playbook",
          max_iterations: 5,
          budget: {
            max_cost_usd: 3.0,
            max_tokens: 300_000,
          },
          stages: [
            {
              id: "inventory",
              steps: [{ id: "git-baseline", mode: "READ_ONLY" }],
            },
            {
              id: "triage-and-remediate",
              steps: [
                { id: "find-high-confidence-issues", mode: "ANALYZE" },
                { id: "bounded-repair", mode: "FIX_WITH_APPROVAL" },
                { id: "targeted-verification", mode: "VERIFY_ONLY" },
              ],
            },
          ],
        },
        budgetTemplate: `# Loop Budget & Constraints Configuration
max_cost_usd: 3.0
max_iterations: 5
max_tokens: 300000
max_wall_time_seconds: 1800
require_test_verification: true
require_worktree_isolation: false
`,
      },
      "test-driven-loop": {
        id: "test-driven-loop",
        name: "Test-Driven Development Loop",
        description: "Enforce Red-Green-Refactor loop: Write failing test first -> Implement minimal fix -> Verify all tests pass.",
        playbookTemplate: {
          $schema: "https://dokion.dev/schemas/user-playbook.v1.schema.json",
          schema_version: "1.0.0",
          pattern: "test-driven-loop",
          name: "TDD Loop Playbook",
          max_iterations: 10,
          budget: {
            max_cost_usd: 5.0,
            max_tokens: 500_000,
          },
          stages: [
            {
              id: "red-failing-test",
              steps: [{ id: "failing-test", mode: "FIX_WITH_APPROVAL" }],
            },
            {
              id: "green-implementation",
              steps: [{ id: "minimal-implementation", mode: "FIX_WITH_APPROVAL" }],
            },
            {
              id: "refactor-and-verify",
              steps: [{ id: "full-verification", mode: "VERIFY_ONLY" }],
            },
          ],
        },
        budgetTemplate: `# Loop Budget & Constraints Configuration
max_cost_usd: 5.0
max_iterations: 10
max_tokens: 500000
max_wall_time_seconds: 3600
require_test_verification: true
require_worktree_isolation: true
`,
      },
      "bug-fix-loop": {
        id: "bug-fix-loop",
        name: "Systematic Bug Fix Loop",
        description: "Reproduce defect -> Isolate root cause -> Apply minimal repair -> Run regression suite -> Generate report.",
        playbookTemplate: {
          $schema: "https://dokion.dev/schemas/user-playbook.v1.schema.json",
          schema_version: "1.0.0",
          pattern: "bug-fix-loop",
          name: "Bug Fix Playbook",
          max_iterations: 3,
          budget: {
            max_cost_usd: 2.5,
            max_tokens: 250_000,
          },
          stages: [
            {
              id: "reproduction",
              steps: [{ id: "reproduce-defect", mode: "ANALYZE" }],
            },
            {
              id: "remediation",
              steps: [{ id: "smallest-fix", mode: "FIX_WITH_APPROVAL" }],
            },
            {
              id: "verification",
              steps: [{ id: "regression-suite", mode: "VERIFY_ONLY" }],
            },
          ],
        },
        budgetTemplate: `# Loop Budget & Constraints Configuration
max_cost_usd: 2.5
max_iterations: 3
max_tokens: 250000
max_wall_time_seconds: 1800
require_test_verification: true
require_worktree_isolation: false
`,
      },
    };

    return patterns[patternId] || patterns["daily-triage"];
  }
}
