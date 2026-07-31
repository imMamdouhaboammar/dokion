import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

export interface LoopBudgetConfig {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxTotalCostUSD?: number;
  maxIterations?: number;
  maxWallTimeSeconds?: number;
}

export class LoopBudgetTracker {
  // Approximate pricing per 1M tokens (Claude Sonnet / Gemini Flash / GPT-4o blend)
  private static INPUT_COST_PER_M = 3.0;
  private static OUTPUT_COST_PER_M = 15.0;

  public static estimateCost(inputTokens: number, outputTokens: number): TokenUsage {
    const totalTokens = inputTokens + outputTokens;
    const costUSD = (inputTokens / 1_000_000) * this.INPUT_COST_PER_M + (outputTokens / 1_000_000) * this.OUTPUT_COST_PER_M;
    return {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUSD: Math.round(costUSD * 1000) / 1000,
    };
  }

  public static loadBudgetConfig(projectDir: string): LoopBudgetConfig {
    const budgetPath = join(projectDir, "loop-budget.md");
    if (!existsSync(budgetPath)) {
      return {
        maxInputTokens: 500_000,
        maxOutputTokens: 100_000,
        maxTotalCostUSD: 5.0,
        maxIterations: 10,
        maxWallTimeSeconds: 3600,
      };
    }

    try {
      const content = readFileSync(budgetPath, "utf8");
      const config: LoopBudgetConfig = {};

      const costMatch = content.match(/max_cost_usd:\s*([0-9.]+)/i) || content.match(/cost_limit:\s*\$?([0-9.]+)/i);
      if (costMatch?.[1]) config.maxTotalCostUSD = parseFloat(costMatch[1]);

      const iterMatch = content.match(/max_iterations:\s*([0-9]+)/i);
      if (iterMatch?.[1]) config.maxIterations = parseInt(iterMatch[1], 10);

      const tokensMatch = content.match(/max_tokens:\s*([0-9]+)/i);
      if (tokensMatch?.[1]) {
        const total = parseInt(tokensMatch[1], 10);
        config.maxInputTokens = Math.round(total * 0.8);
        config.maxOutputTokens = Math.round(total * 0.2);
      }

      return {
        maxInputTokens: config.maxInputTokens ?? 500_000,
        maxOutputTokens: config.maxOutputTokens ?? 100_000,
        maxTotalCostUSD: config.maxTotalCostUSD ?? 5.0,
        maxIterations: config.maxIterations ?? 10,
        maxWallTimeSeconds: config.maxWallTimeSeconds ?? 3600,
      };
    } catch {
      return {
        maxTotalCostUSD: 5.0,
        maxIterations: 10,
      };
    }
  }

  public static isWithinBudget(currentUsage: TokenUsage, currentIteration: number, config: LoopBudgetConfig): { allowed: boolean; reason?: string } {
    if (config.maxTotalCostUSD && currentUsage.estimatedCostUSD > config.maxTotalCostUSD) {
      return { allowed: false, reason: `Estimated cost ($${currentUsage.estimatedCostUSD}) exceeded limit ($${config.maxTotalCostUSD})` };
    }
    if (config.maxIterations && currentIteration > config.maxIterations) {
      return { allowed: false, reason: `Iterations (${currentIteration}) exceeded limit (${config.maxIterations})` };
    }
    return { allowed: true };
  }
}
