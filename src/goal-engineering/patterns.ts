export interface GoalPatternTemplate {
  id: string;
  name: string;
  description: string;
  recommendedLevel: "G1" | "G2" | "G3" | "G4" | "G5";
  goalMdTemplate: string;
  budgetTemplate: string;
}

export class GoalPatterns {
  public static readonly PATTERNS: Record<string, GoalPatternTemplate> = {
    "tests-green": {
      id: "tests-green",
      name: "Tests Green Objective",
      description: "Run test suite, fix broken tests and regressions until all tests pass and verifier confirms.",
      recommendedLevel: "G2",
      goalMdTemplate: `# GOAL: Make All Tests Pass

## Objective
Run the test suite and fix failing tests, regressions, or broken contracts until the entire test suite passes cleanly.

## Done Condition
- \`bun test\` (or configured test command) passes with 0 failures.
- No skipped or muted test assertions without documented approvals.
- Goal verifier skill reports \`completed: true\`.

## Verifier Command
\`\`\`bash
bun test
\`\`\`

## Progress Log
- Initial goal scaffolded.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G2
max_cost_usd: 0.25
max_turns: 8
max_tokens: 25000
`,
    },
    "migrate-module": {
      id: "migrate-module",
      name: "Migrate Module Objective",
      description: "Migrate module or subsystem to a updated version or framework while preserving behavior.",
      recommendedLevel: "G3",
      goalMdTemplate: `# GOAL: Migrate Target Module

## Objective
Migrate target module to updated interfaces, dependencies, or standard conventions without breaking contracts.

## Done Condition
- Target module rewritten/updated to match new specification.
- Unit and integration tests pass without regressions.
- Goal verifier checks pass.

## Verifier Command
\`\`\`bash
bun test && dokion verify
\`\`\`

## Progress Log
- Initial goal scaffolded for module migration.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G3
max_cost_usd: 0.60
max_turns: 15
max_tokens: 60000
`,
    },
    "implement-feature": {
      id: "implement-feature",
      name: "Implement Feature Objective",
      description: "Implement a feature according to spec with new unit tests and verifier validation.",
      recommendedLevel: "G3",
      goalMdTemplate: `# GOAL: Implement Feature

## Objective
Implement specified feature, export clean API contracts, and add thorough unit tests.

## Done Condition
- New feature code implemented in target modules.
- New unit tests added and passing.
- Dokion verification gates green.

## Verifier Command
\`\`\`bash
bun test
\`\`\`

## Progress Log
- Initial goal scaffolded for feature implementation.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G3
max_cost_usd: 0.60
max_turns: 15
max_tokens: 60000
`,
    },
    "fix-bug": {
      id: "fix-bug",
      name: "Fix Bug Objective",
      description: "Isolate root cause of defect, write reproducing test, fix bug, and verify regression safety.",
      recommendedLevel: "G2",
      goalMdTemplate: `# GOAL: Fix Defect

## Objective
Reproduce the reported bug, isolate root cause, implement surgical fix, and add regression test.

## Done Condition
- Reproducing test passes cleanly after fix.
- No side effects or regressions introduced.
- Goal verifier returns \`completed: true\`.

## Verifier Command
\`\`\`bash
bun test
\`\`\`

## Progress Log
- Initial goal scaffolded for bug repair.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G2
max_cost_usd: 0.25
max_turns: 8
max_tokens: 25000
`,
    },
    "refactor-safely": {
      id: "refactor-safely",
      name: "Refactor Safely Objective",
      description: "Clean up code debt or improve performance without altering external contracts.",
      recommendedLevel: "G2",
      goalMdTemplate: `# GOAL: Refactor Code Safely

## Objective
Refactor target implementation for readability, performance, or unslop quality while preserving exact behavior.

## Done Condition
- Code refactored without breaking external signatures.
- All existing tests pass cleanly.
- Static analysis & linting checks green.

## Verifier Command
\`\`\`bash
bun test && dokion validate
\`\`\`

## Progress Log
- Initial goal scaffolded for safe refactoring.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G2
max_cost_usd: 0.25
max_turns: 8
max_tokens: 25000
`,
    },
    "coverage-target": {
      id: "coverage-target",
      name: "Coverage Target Objective",
      description: "Increase test suite coverage to target percentage threshold.",
      recommendedLevel: "G3",
      goalMdTemplate: `# GOAL: Increase Test Coverage

## Objective
Add tests to un-covered modules until test coverage reaches configured target threshold.

## Done Condition
- Test coverage meets or exceeds threshold.
- Test suite passes cleanly without flaky assertions.

## Verifier Command
\`\`\`bash
bun test --coverage
\`\`\`

## Progress Log
- Initial goal scaffolded for coverage target.
`,
      budgetTemplate: `# Goal Budget Configuration
level: G3
max_cost_usd: 0.60
max_turns: 15
max_tokens: 60000
`,
    },
  };

  public static listPatterns(): GoalPatternTemplate[] {
    return Object.values(this.PATTERNS);
  }

  public static getPattern(id: string): GoalPatternTemplate | undefined {
    return this.PATTERNS[id.toLowerCase()];
  }
}
