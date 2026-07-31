export interface ReliabilityConfig {
  loggingStructured?: boolean;
  healthEndpoint?: string;
  maxTimeoutMs?: number;
  idempotencyHeaders?: boolean;
}

export interface PerformanceConfig {
  maxLcpMs?: number;
  maxInpMs?: number;
}

export interface AccessibilityConfig {
  wcagLevel?: "A" | "AA" | "AAA";
  requireAriaLabels?: boolean;
}

export interface ReliabilityPerformanceAccessibilityConfig {
  reliability?: ReliabilityConfig;
  performance?: PerformanceConfig;
  accessibility?: AccessibilityConfig;
}

export interface EvaluationMetrics {
  structuredLogsFound?: boolean;
  healthCheckPassed?: boolean;
  lcpMs?: number;
  inpMs?: number;
  wcagViolationsCount?: number;
}

export interface ModuleFinding {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
}

export interface ModuleEvaluationResult {
  valid: boolean;
  score: number;
  findings: ModuleFinding[];
}

export function evaluateReliabilityPerformanceAccessibility(
  config: ReliabilityPerformanceAccessibilityConfig,
  metrics: EvaluationMetrics
): ModuleEvaluationResult {
  const findings: ModuleFinding[] = [];
  let score = 100;

  if (config.reliability) {
    if (config.reliability.loggingStructured && !metrics.structuredLogsFound) {
      findings.push({
        id: "RELIABILITY-UNSTRUCTURED-LOGS",
        severity: "MEDIUM",
        message: "Structured logging is required but not found in runtime logs",
      });
      score -= 15;
    }
    if (config.reliability.healthEndpoint && metrics.healthCheckPassed === false) {
      findings.push({
        id: "RELIABILITY-HEALTHCHECK-FAILED",
        severity: "HIGH",
        message: `Health check failed for endpoint ${config.reliability.healthEndpoint}`,
      });
      score -= 25;
    }
  }

  if (config.performance) {
    if (config.performance.maxLcpMs && metrics.lcpMs !== undefined && metrics.lcpMs > config.performance.maxLcpMs) {
      findings.push({
        id: "PERF-LCP-EXCEEDED",
        severity: "HIGH",
        message: `Largest Contentful Paint (${metrics.lcpMs}ms) exceeded threshold (${config.performance.maxLcpMs}ms)`,
      });
      score -= 20;
    }
    if (config.performance.maxInpMs && metrics.inpMs !== undefined && metrics.inpMs > config.performance.maxInpMs) {
      findings.push({
        id: "PERF-INP-EXCEEDED",
        severity: "MEDIUM",
        message: `Interaction to Next Paint (${metrics.inpMs}ms) exceeded threshold (${config.performance.maxInpMs}ms)`,
      });
      score -= 15;
    }
  }

  if (config.accessibility) {
    if (metrics.wcagViolationsCount !== undefined && metrics.wcagViolationsCount > 0) {
      findings.push({
        id: "A11Y-WCAG-VIOLATION",
        severity: "CRITICAL",
        message: `Found ${metrics.wcagViolationsCount} WCAG accessibility violations`,
      });
      score -= 30;
    }
  }

  const clampedScore = Math.max(0, score);
  return {
    valid: findings.length === 0,
    score: clampedScore,
    findings,
  };
}
