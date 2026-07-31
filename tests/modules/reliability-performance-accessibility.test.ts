import { describe, test, expect } from "bun:test";
import { evaluateReliabilityPerformanceAccessibility } from "../../src/modules/adapters/reliability-performance";

describe("MOD-009 Reliability, Performance, and WCAG Accessibility Module", () => {
  test("evaluates observability, reliability, performance web-vitals, and WCAG accessibility rules", () => {
    const config = {
      reliability: {
        loggingStructured: true,
        healthEndpoint: "/healthz",
        maxTimeoutMs: 5000,
        idempotencyHeaders: true,
      },
      performance: {
        maxLcpMs: 2500,
        maxInpMs: 200,
      },
      accessibility: {
        wcagLevel: "AA" as const,
        requireAriaLabels: true,
      },
    };

    const metrics = {
      structuredLogsFound: true,
      healthCheckPassed: true,
      lcpMs: 1800,
      inpMs: 120,
      wcagViolationsCount: 0,
    };

    const result = evaluateReliabilityPerformanceAccessibility(config, metrics);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.findings).toHaveLength(0);
  });

  test("flags violations when performance or accessibility thresholds fail", () => {
    const config = {
      reliability: {
        loggingStructured: false,
        healthEndpoint: "/healthz",
        maxTimeoutMs: 5000,
        idempotencyHeaders: false,
      },
      performance: {
        maxLcpMs: 2500,
        maxInpMs: 200,
      },
      accessibility: {
        wcagLevel: "AA" as const,
        requireAriaLabels: true,
      },
    };

    const metrics = {
      structuredLogsFound: false,
      healthCheckPassed: false,
      lcpMs: 3200, // exceeds 2500
      inpMs: 300, // exceeds 200
      wcagViolationsCount: 3,
    };

    const result = evaluateReliabilityPerformanceAccessibility(config, metrics);
    expect(result.valid).toBe(false);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.map((f) => f.id)).toContain("PERF-LCP-EXCEEDED");
    expect(result.findings.map((f) => f.id)).toContain("A11Y-WCAG-VIOLATION");
  });
});
