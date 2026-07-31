import type { GoalArchetype, SuccessPredicate, ExecutionHop, AutoresearchState } from "./types.ts";

export function classifyGoal(goal: string): {
  archetype: GoalArchetype;
  mode: "loop" | "dispatch";
  defaultPipeline: ExecutionHop[];
} {
  const lower = goal.toLowerCase();

  if (/\b(ship|release|deploy|publish|production-ready|merge)\b/.test(lower)) {
    return {
      archetype: "ship-ready",
      mode: "loop",
      defaultPipeline: ["probe", "debug", "fix", "regression", "ship"],
    };
  }

  if (/\b(improve|optimize|increase|reduce|faster|smaller|coverage|score)\b/.test(lower)) {
    return {
      archetype: "optimize-metric",
      mode: "loop",
      defaultPipeline: ["plan", "evals"],
    };
  }

  if (/\b(fix|broken|failing|error|crash|bug|can't run|tests fail|crush)\b/.test(lower)) {
    return {
      archetype: "fix-broken",
      mode: "loop",
      defaultPipeline: ["debug", "fix", "regression"],
    };
  }

  if (/\b(security|vulnerability|audit|owasp|cve|harden|lock down)\b/.test(lower)) {
    return {
      archetype: "harden",
      mode: "loop",
      defaultPipeline: ["security", "fix", "security"],
    };
  }

  if (/\b(build|add|implement|create|new feature|acceptance test)\b/.test(lower)) {
    return {
      archetype: "build-feature",
      mode: "loop",
      defaultPipeline: ["debug", "fix", "regression"],
    };
  }

  if (/\b(document|wiki|generate docs|explain codebase|write guide)\b/.test(lower)) {
    return {
      archetype: "document",
      mode: "dispatch",
      defaultPipeline: ["learn"],
    };
  }

  if (/\b(what should i build|ideas|improvements|prd|roadmap)\b/.test(lower)) {
    return {
      archetype: "what-to-build",
      mode: "dispatch",
      defaultPipeline: ["improve"],
    };
  }

  if (/\b(which approach|compare options|design decision|architecture choice)\b/.test(lower)) {
    return {
      archetype: "decide-design",
      mode: "dispatch",
      defaultPipeline: ["reason"],
    };
  }

  return {
    archetype: "explore",
    mode: "loop",
    defaultPipeline: ["probe", "scenario", "plan"],
  };
}

export function derivePredicate(goal: string, archetype: GoalArchetype): SuccessPredicate {
  switch (archetype) {
    case "fix-broken":
    case "build-feature":
    case "ship-ready":
      return {
        command: "bun test",
        expectedExitCode: 0,
      };
    case "harden":
      return {
        command: "bun run validate:contracts",
        expectedExitCode: 0,
      };
    case "optimize-metric":
      return {
        command: "bun test",
        comparison: "numeric_min",
        targetValue: 100,
      };
    default:
      return {
        command: "bun test",
        expectedExitCode: 0,
      };
  }
}

export function screenCommand(cmd: string): { allowed: boolean; reason?: string } {
  const dangerousPatterns = [
    /\brm\s+-rf\s+\/$/i,
    />\s*\/dev\/null/i,
    /\bsudo\b/i,
    /\bcurl\s+.*\|\s*sh\b/i,
    /\bwget\s+.*\|\s*sh\b/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      return {
        allowed: false,
        reason: `Command matching security risk pattern rejected: ${cmd}`,
      };
    }
  }

  return { allowed: true };
}

export function detectPlateau(unitsHistory: number[], windowSize = 5): boolean {
  if (unitsHistory.length < windowSize) {
    return false;
  }

  const recent = unitsHistory.slice(-windowSize);
  const first = recent[0];
  if (first === undefined) return false;
  return recent.every((val) => val >= first);
}

export function createInitialState(
  goal: string,
  maxCycles = 50
): AutoresearchState {
  const classification = classifyGoal(goal);
  const predicate = derivePredicate(goal, classification.archetype);

  return {
    goal,
    archetype: classification.archetype,
    mode: classification.mode,
    predicate,
    cycleCount: 0,
    maxCycles,
    unitsRemaining: 100,
    unitsHistory: [100],
    pipelineLog: [],
    status: "RUNNING",
  };
}
