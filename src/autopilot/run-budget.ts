export interface BudgetLimits {
  maxWallTimeSeconds?: number;
  maxCommands?: number;
  maxRetries?: number;
  maxRepairs?: number;
  maxFindings?: number;
  maxEvidenceBytes?: number;
  maxChangedLines?: number;
}

export interface BudgetUsage {
  wallTimeSeconds: number;
  commandsRun: number;
  retriesAttempted: number;
  repairsAttempted: number;
  findingsCount: number;
  evidenceSizeBytes: number;
  changedLinesCount: number;
}

export interface BudgetCheckResult {
  exceeded: boolean;
  exceededBudget?: keyof BudgetLimits;
  message: string;
}

export function checkRunBudgets(
  usage: BudgetUsage,
  limits: BudgetLimits
): BudgetCheckResult {
  if (limits.maxWallTimeSeconds !== undefined && usage.wallTimeSeconds > limits.maxWallTimeSeconds) {
    return {
      exceeded: true,
      exceededBudget: 'maxWallTimeSeconds',
      message: `Wall-time limit exceeded: ${usage.wallTimeSeconds}s > ${limits.maxWallTimeSeconds}s`,
    };
  }

  if (limits.maxCommands !== undefined && usage.commandsRun >= limits.maxCommands) {
    return {
      exceeded: true,
      exceededBudget: 'maxCommands',
      message: `Command execution limit reached: ${usage.commandsRun} >= ${limits.maxCommands}`,
    };
  }

  if (limits.maxRetries !== undefined && usage.retriesAttempted >= limits.maxRetries) {
    return {
      exceeded: true,
      exceededBudget: 'maxRetries',
      message: `Retry limit reached: ${usage.retriesAttempted} >= ${limits.maxRetries}`,
    };
  }

  if (limits.maxRepairs !== undefined && usage.repairsAttempted >= limits.maxRepairs) {
    return {
      exceeded: true,
      exceededBudget: 'maxRepairs',
      message: `Repair attempt limit reached: ${usage.repairsAttempted} >= ${limits.maxRepairs}`,
    };
  }

  if (limits.maxFindings !== undefined && usage.findingsCount > limits.maxFindings) {
    return {
      exceeded: true,
      exceededBudget: 'maxFindings',
      message: `Finding count limit exceeded: ${usage.findingsCount} > ${limits.maxFindings}`,
    };
  }

  if (limits.maxEvidenceBytes !== undefined && usage.evidenceSizeBytes > limits.maxEvidenceBytes) {
    return {
      exceeded: true,
      exceededBudget: 'maxEvidenceBytes',
      message: `Evidence byte limit exceeded: ${usage.evidenceSizeBytes}B > ${limits.maxEvidenceBytes}B`,
    };
  }

  if (limits.maxChangedLines !== undefined && usage.changedLinesCount > limits.maxChangedLines) {
    return {
      exceeded: true,
      exceededBudget: 'maxChangedLines',
      message: `Changed lines limit exceeded: ${usage.changedLinesCount} > ${limits.maxChangedLines}`,
    };
  }

  return {
    exceeded: false,
    message: 'All usage metrics remain within defined run budgets',
  };
}
