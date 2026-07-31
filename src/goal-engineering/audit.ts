import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface GoalAuditItem {
  id: string;
  category: "goal-spec" | "verifier-skills" | "budget-limits" | "telemetry-journaling" | "git-isolation";
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
  details: string;
  recommendation?: string | undefined;
}

export interface GoalAuditReport {
  timestamp: string;
  targetPath: string;
  readinessScore: number;
  grade: "GOAL_READY" | "NEEDS_HARNESS" | "UNPREPARED";
  items: GoalAuditItem[];
  topRecommendations: string[];
}

export class GoalAuditEngine {
  public static audit(projectDir: string): GoalAuditReport {
    const items: GoalAuditItem[] = [];

    // 1. Goal Specification (GOAL.md) (25 pts)
    const hasGoalMd = existsSync(join(projectDir, "GOAL.md"));
    let goalSpecScore = 0;
    let goalMdDetails = "GOAL.md missing";

    if (hasGoalMd) {
      goalSpecScore += 12;
      try {
        const content = readFileSync(join(projectDir, "GOAL.md"), "utf8");
        if (content.includes("## Objective") || content.includes("Objective:")) goalSpecScore += 5;
        if (content.includes("## Done Condition") || content.includes("verifier")) goalSpecScore += 5;
        if (content.includes("status") || content.includes("PROGRESS")) goalSpecScore += 3;
        goalMdDetails = `GOAL.md present (${content.length} bytes)`;
      } catch {
        goalMdDetails = "GOAL.md exists but could not be read";
      }
    }

    items.push({
      id: "goal-spec",
      category: "goal-spec",
      name: "Goal Specification (GOAL.md)",
      score: goalSpecScore,
      maxScore: 25,
      passed: goalSpecScore >= 17,
      details: goalMdDetails,
      recommendation: !hasGoalMd ? "Run 'dokion goal init --pattern tests-green' to scaffold a GOAL.md template." : undefined,
    });

    // 2. Verifier Skills & Verification Gates (25 pts)
    const hasPackageJson = existsSync(join(projectDir, "package.json"));
    let verifierScore = 0;
    let hasTestScript = false;
    let hasVerifierScript = false;

    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
        const scripts = pkg.scripts || {};
        if (scripts.test) {
          hasTestScript = true;
          verifierScore += 12;
        }
        if (scripts.verify || scripts["goal-verifier"] || scripts.check) {
          hasVerifierScript = true;
          verifierScore += 8;
        }
        if (scripts.typecheck || scripts.build || scripts.lint) {
          verifierScore += 5;
        }
      } catch {
        // Invalid JSON
      }
    } else if (existsSync(join(projectDir, "Makefile")) || existsSync(join(projectDir, "pytest.ini"))) {
      verifierScore += 15;
    }

    if (existsSync(join(projectDir, "scripts", "goal-verifier.sh")) || existsSync(join(projectDir, "scripts", "verify.sh"))) {
      verifierScore = Math.min(25, verifierScore + 8);
      hasVerifierScript = true;
    }

    items.push({
      id: "verifier-skills",
      category: "verifier-skills",
      name: "Verifier Skills & Test Gates",
      score: verifierScore,
      maxScore: 25,
      passed: verifierScore >= 12,
      details: `Test script: ${hasTestScript}, Verifier script: ${hasVerifierScript}`,
      recommendation: !hasTestScript ? "Provide a test or verifier command so Dokion can confirm goal completion objectively." : undefined,
    });

    // 3. Token & Turn Budget Limits (20 pts)
    const hasGoalBudgetMd = existsSync(join(projectDir, "goal-budget.md"));
    const hasPlaybook = existsSync(join(projectDir, ".dokion", "playbook.json"));
    let budgetScore = 0;

    if (hasGoalBudgetMd) budgetScore += 15;
    if (hasPlaybook) budgetScore += 5;

    items.push({
      id: "budget-limits",
      category: "budget-limits",
      name: "Token & Turn Budget Limits",
      score: budgetScore,
      maxScore: 20,
      passed: budgetScore >= 10,
      details: `goal-budget.md: ${hasGoalBudgetMd}, Dokion Playbook: ${hasPlaybook}`,
      recommendation: !hasGoalBudgetMd ? "Run 'dokion goal estimate' or create 'goal-budget.md' to bound token usage and max turns." : undefined,
    });

    // 4. Telemetry & Journaling (15 pts)
    const hasRunLogMd = existsSync(join(projectDir, "goal-run-log.md"));
    const hasGoalStateJson = existsSync(join(projectDir, ".dokion", "goal-state.json"));
    let telemetryScore = 0;

    if (hasRunLogMd) telemetryScore += 8;
    if (hasGoalStateJson) telemetryScore += 7;

    items.push({
      id: "telemetry-journaling",
      category: "telemetry-journaling",
      name: "Goal Telemetry & Run Journaling",
      score: telemetryScore,
      maxScore: 15,
      passed: telemetryScore >= 7,
      details: `goal-run-log.md: ${hasRunLogMd}, .dokion/goal-state.json: ${hasGoalStateJson}`,
      recommendation: !hasRunLogMd ? "Run 'dokion goal sync' to establish telemetry journaling." : undefined,
    });

    // 5. Git & Isolation (15 pts)
    const hasGit = existsSync(join(projectDir, ".git"));
    let isolationScore = 0;
    if (hasGit) isolationScore += 10;
    if (existsSync(join(projectDir, ".gitignore"))) isolationScore += 5;

    items.push({
      id: "git-isolation",
      category: "git-isolation",
      name: "Git Repository & Rollback Cleanliness",
      score: isolationScore,
      maxScore: 15,
      passed: isolationScore >= 10,
      details: `Git repository present: ${hasGit}`,
      recommendation: !hasGit ? "Initialize Git to enable snapshot rollback during goal execution." : undefined,
    });

    const totalScore = items.reduce((sum, item) => sum + item.score, 0);
    let grade: GoalAuditReport["grade"] = "UNPREPARED";
    if (totalScore >= 80) grade = "GOAL_READY";
    else if (totalScore >= 50) grade = "NEEDS_HARNESS";

    const topRecommendations = items
      .filter((i) => !i.passed && i.recommendation)
      .map((i) => i.recommendation!);

    return {
      timestamp: new Date().toISOString(),
      targetPath: projectDir,
      readinessScore: totalScore,
      grade,
      items,
      topRecommendations,
    };
  }
}
