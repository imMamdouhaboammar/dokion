import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface GoalDifficultyEstimate {
  level: "G1" | "G2" | "G3" | "G4" | "G5";
  name: string;
  description: string;
  estimatedTokens: number;
  maxTurns: number;
  estimatedCostUSD: number;
}

export interface GoalBudgetConfig {
  level: "G1" | "G2" | "G3" | "G4" | "G5";
  maxTotalCostUSD: number;
  maxTurns: number;
  maxTokens: number;
}

export class GoalBudgetTracker {
  public static readonly DIFFICULTY_LEVELS: Record<string, GoalDifficultyEstimate> = {
    G1: {
      level: "G1",
      name: "Micro Fix",
      description: "Targeted single-file edit or minor bug fix",
      estimatedTokens: 5_000,
      maxTurns: 3,
      estimatedCostUSD: 0.05,
    },
    G2: {
      level: "G2",
      name: "Single Module",
      description: "Refactoring or extending a single package/module with tests",
      estimatedTokens: 25_000,
      maxTurns: 8,
      estimatedCostUSD: 0.25,
    },
    G3: {
      level: "G3",
      name: "Multi-Module Feature",
      description: "Implementing a feature across multiple components with verifiers",
      estimatedTokens: 60_000,
      maxTurns: 15,
      estimatedCostUSD: 0.60,
    },
    G4: {
      level: "G4",
      name: "Subsystem Migration",
      description: "Migrating or rewriting a core subsystem while preserving behavior",
      estimatedTokens: 120_000,
      maxTurns: 30,
      estimatedCostUSD: 1.20,
    },
    G5: {
      level: "G5",
      name: "Architectural Overhaul",
      description: "Large repository-wide refactoring, multi-phase verification & migration",
      estimatedTokens: 250_000,
      maxTurns: 50,
      estimatedCostUSD: 2.50,
    },
  };

  public static getEstimate(levelStr?: string): GoalDifficultyEstimate {
    const key = (levelStr || "G2").toUpperCase();
    return this.DIFFICULTY_LEVELS[key] || this.DIFFICULTY_LEVELS.G2!;
  }

  public static loadBudgetConfig(projectDir: string): GoalBudgetConfig {
    const defaultEstimate = this.getEstimate("G2");
    const budgetPath = join(projectDir, "goal-budget.md");

    if (existsSync(budgetPath)) {
      try {
        const content = readFileSync(budgetPath, "utf8");
        const levelMatch = /level:\s*(G[1-5])/i.exec(content);
        const costMatch = /max_cost_usd:\s*([0-9.]+)/i.exec(content);
        const turnsMatch = /max_turns:\s*([0-9]+)/i.exec(content);
        const tokensMatch = /max_tokens:\s*([0-9_]+)/i.exec(content);

        const levelKey = levelMatch?.[1]?.toUpperCase() || "G2";
        const estimate = this.getEstimate(levelKey);

        return {
          level: estimate.level,
          maxTotalCostUSD: costMatch ? parseFloat(costMatch[1]!) : estimate.estimatedCostUSD,
          maxTurns: turnsMatch ? parseInt(turnsMatch[1]!, 10) : estimate.maxTurns,
          maxTokens: tokensMatch ? parseInt(tokensMatch[1]!.replace(/_/g, ""), 10) : estimate.estimatedTokens,
        };
      } catch {
        // Fallback to default G2
      }
    }

    return {
      level: defaultEstimate.level,
      maxTotalCostUSD: defaultEstimate.estimatedCostUSD,
      maxTurns: defaultEstimate.maxTurns,
      maxTokens: defaultEstimate.estimatedTokens,
    };
  }

  public static estimateCost(
    inputTokens: number,
    outputTokens: number,
    costPer1kInput = 0.003,
    costPer1kOutput = 0.015
  ): { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUSD: number } {
    const totalTokens = inputTokens + outputTokens;
    const cost = (inputTokens / 1000) * costPer1kInput + (outputTokens / 1000) * costPer1kOutput;
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUSD: Math.round(cost * 10000) / 10000,
    };
  }

  public static isWithinBudget(
    usage: { totalTokens: number; estimatedCostUSD: number },
    turnsCount: number,
    config: GoalBudgetConfig
  ): { allowed: boolean; reason?: string } {
    if (config.maxTurns && turnsCount > config.maxTurns) {
      return { allowed: false, reason: `Turns limit exceeded (${turnsCount} > max ${config.maxTurns})` };
    }
    if (config.maxTokens && usage.totalTokens > config.maxTokens) {
      return { allowed: false, reason: `Token limit exceeded (${usage.totalTokens} > max ${config.maxTokens})` };
    }
    if (config.maxTotalCostUSD && usage.estimatedCostUSD > config.maxTotalCostUSD) {
      return { allowed: false, reason: `Cost limit exceeded ($${usage.estimatedCostUSD} > max $${config.maxTotalCostUSD})` };
    }
    return { allowed: true };
  }
}
