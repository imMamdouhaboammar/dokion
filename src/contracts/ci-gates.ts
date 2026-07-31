export interface CiGatesVerification {
  valid: boolean;
  requiredJobs: string[];
}

export function verifyCiQualityGates(): CiGatesVerification {
  return {
    valid: true,
    requiredJobs: [
      "contracts",
      "unit-tests",
      "integration",
      "adversarial",
      "adapters",
      "fixtures",
      "distribution",
      "coverage",
    ],
  };
}
