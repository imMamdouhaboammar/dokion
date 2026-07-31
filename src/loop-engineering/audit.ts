import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface LoopAuditItem {
  id: string;
  category: "state" | "verification" | "budget" | "isolation" | "patterns";
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
  details: string;
  recommendation?: string | undefined;
}

export interface LoopAuditReport {
  timestamp: string;
  targetPath: string;
  readinessScore: number;
  grade: "LOOP_READY" | "NEEDS_HARNESS" | "UNPREPARED";
  items: LoopAuditItem[];
  topRecommendations: string[];
}

export class LoopAuditEngine {
  public static audit(projectDir: string): LoopAuditReport {
    const items: LoopAuditItem[] = [];

    // 1. State & Journaling (20 pts)
    const hasPlaybook = existsSync(join(projectDir, ".dokion", "playbook.json"));
    const hasState = existsSync(join(projectDir, ".dokion", "state.json"));
    const hasStateMd = existsSync(join(projectDir, "STATE.md"));
    const hasLoopMd = existsSync(join(projectDir, "LOOP.md"));

    let stateScore = 0;
    if (hasPlaybook) stateScore += 8;
    if (hasState) stateScore += 5;
    if (hasStateMd) stateScore += 4;
    if (hasLoopMd) stateScore += 3;

    items.push({
      id: "state-journaling",
      category: "state",
      name: "Durable State & Journaling",
      score: stateScore,
      maxScore: 20,
      passed: stateScore >= 13,
      details: `Playbook: ${hasPlaybook}, State JSON: ${hasState}, STATE.md: ${hasStateMd}, LOOP.md: ${hasLoopMd}`,
      recommendation: !hasPlaybook ? "Run 'dokion loop init' to scaffold an executable playbook." : undefined,
    });

    // 2. Automated Verification Gates (25 pts)
    const hasPackageJson = existsSync(join(projectDir, "package.json"));
    let verificationScore = 0;
    let hasTestScript = false;
    let hasTypecheckScript = false;

    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
        const scripts = pkg.scripts || {};
        if (scripts.test) {
          hasTestScript = true;
          verificationScore += 12;
        }
        if (scripts.typecheck || scripts.tsc) {
          hasTypecheckScript = true;
          verificationScore += 8;
        }
        if (scripts.lint || scripts.build) {
          verificationScore += 5;
        }
      } catch {
        // invalid JSON
      }
    } else if (existsSync(join(projectDir, "Makefile")) || existsSync(join(projectDir, "pytest.ini"))) {
      verificationScore += 15;
    }

    items.push({
      id: "verification-gates",
      category: "verification",
      name: "Automated Verification Gates",
      score: verificationScore,
      maxScore: 25,
      passed: verificationScore >= 12,
      details: `Test script: ${hasTestScript}, Typecheck script: ${hasTypecheckScript}`,
      recommendation: !hasTestScript ? "Add a deterministic test command (e.g. 'bun test' or 'npm test') to enable automated loop verification." : undefined,
    });

    // 3. Budget & Constraints (20 pts)
    const hasBudgetMd = existsSync(join(projectDir, "loop-budget.md"));
    const hasConstraintsMd = existsSync(join(projectDir, "loop-constraints.md"));

    let budgetScore = 0;
    if (hasBudgetMd) budgetScore += 10;
    if (hasConstraintsMd) budgetScore += 10;
    if (!hasBudgetMd && hasPlaybook) {
      try {
        const pb = JSON.parse(readFileSync(join(projectDir, ".dokion", "playbook.json"), "utf8"));
        if (pb.budget || pb.max_iterations) {
          budgetScore += 10;
        }
      } catch {
        // ignore
      }
    }

    items.push({
      id: "budget-constraints",
      category: "budget",
      name: "Budget & Constraint Boundaries",
      score: budgetScore,
      maxScore: 20,
      passed: budgetScore >= 10,
      details: `loop-budget.md: ${hasBudgetMd}, loop-constraints.md: ${hasConstraintsMd}`,
      recommendation: !hasBudgetMd ? "Create 'loop-budget.md' or declare token/iteration limits in your playbook to prevent runaway loop costs." : undefined,
    });

    // 4. Git & Worktree Isolation (15 pts)
    const hasGit = existsSync(join(projectDir, ".git"));
    let isolationScore = 0;
    if (hasGit) isolationScore += 10;
    if (existsSync(join(projectDir, ".gitignore"))) isolationScore += 5;

    items.push({
      id: "git-isolation",
      category: "isolation",
      name: "Git & Worktree Isolation",
      score: isolationScore,
      maxScore: 15,
      passed: isolationScore >= 10,
      details: `Git repository: ${hasGit}`,
      recommendation: !hasGit ? "Initialize a Git repository to enable snapshot rollback and worktree isolation." : undefined,
    });

    // 5. Pattern Alignment & Skills (20 pts)
    let patternScore = 10;
    if (hasPlaybook) {
      try {
        const pb = JSON.parse(readFileSync(join(projectDir, ".dokion", "playbook.json"), "utf8"));
        if (pb.pattern || pb.stages || pb.steps) patternScore += 10;
      } catch {
        // ignore
      }
    }

    items.push({
      id: "pattern-alignment",
      category: "patterns",
      name: "Loop Pattern Alignment",
      score: patternScore,
      maxScore: 20,
      passed: patternScore >= 15,
      details: `Configured stages/patterns: ${patternScore >= 15}`,
      recommendation: patternScore < 15 ? "Select a canonical loop pattern (e.g. daily-triage, test-driven-loop, bug-fix-loop) using 'dokion loop init'." : undefined,
    });

    const totalScore = items.reduce((acc, curr) => acc + curr.score, 0);
    let grade: "LOOP_READY" | "NEEDS_HARNESS" | "UNPREPARED" = "UNPREPARED";
    if (totalScore >= 80) grade = "LOOP_READY";
    else if (totalScore >= 50) grade = "NEEDS_HARNESS";

    const topRecommendations = items
      .filter((item) => item.recommendation)
      .map((item) => item.recommendation!);

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
