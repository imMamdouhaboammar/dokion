export interface MemoryBudgetLimits {
  maxScratchEntries: number;
  maxEpisodicDays: number;
  maxDurableFacts: number;
  maxRetrievalTokensPerTurn: number;
}

export const DEFAULT_MEMORY_BUDGET: MemoryBudgetLimits = {
  maxScratchEntries: 20,
  maxEpisodicDays: 30,
  maxDurableFacts: 100,
  maxRetrievalTokensPerTurn: 2000,
};

export interface MemoryUsageStats {
  scratchCount: number;
  episodicCount: number;
  durableCount: number;
  estimatedTokens: number;
  budgetExceeded: boolean;
  warnings: string[];
}

export function evaluateMemoryBudget(
  stats: { scratchCount: number; episodicCount: number; durableCount: number; estimatedTokens: number },
  limits: MemoryBudgetLimits = DEFAULT_MEMORY_BUDGET,
): MemoryUsageStats {
  const warnings: string[] = [];

  if (stats.scratchCount > limits.maxScratchEntries) {
    warnings.push(`Scratch entries (${stats.scratchCount}) exceed limit (${limits.maxScratchEntries}). Consider promoting or purging.`);
  }

  if (stats.durableCount > limits.maxDurableFacts) {
    warnings.push(`Durable facts (${stats.durableCount}) exceed limit (${limits.maxDurableFacts}). Audit for stale entries.`);
  }

  if (stats.estimatedTokens > limits.maxRetrievalTokensPerTurn) {
    warnings.push(`Estimated retrieval tokens (${stats.estimatedTokens}) exceed turn budget (${limits.maxRetrievalTokensPerTurn}).`);
  }

  return {
    ...stats,
    budgetExceeded: warnings.length > 0,
    warnings,
  };
}
