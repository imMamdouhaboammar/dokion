export interface EnvironmentRequirement {
  name: string;
  required?: boolean;
  pattern?: string;
  allowedValues?: readonly string[];
  allowEmpty?: boolean;
}

export type EnvironmentCheckStatus = "PASS" | "MISSING" | "INVALID" | "DENIED";

export interface EnvironmentVariableCheck {
  name: string;
  status: EnvironmentCheckStatus;
  present: boolean;
  redacted: true;
  reason?: string;
}

export interface EnvironmentCheckResult {
  valid: boolean;
  allowedNames: string[];
  checks: EnvironmentVariableCheck[];
}

const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]*$/;

const DANGEROUS_LOADER_VARIABLES = new Set([
  "BUN_OPTIONS",
  "DYLD_FALLBACK_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "GIT_SSH_COMMAND",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "NODE_OPTIONS",
  "PERL5OPT",
  "PYTHONPATH",
  "RUBYOPT"
]);

function compareNames(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function checkRequirement(
  requirement: EnvironmentRequirement,
  environment: Readonly<Record<string, string | undefined>>
): EnvironmentVariableCheck {
  const value = environment[requirement.name];
  const present = value !== undefined;

  if (!ENVIRONMENT_NAME.test(requirement.name)) {
    return {
      name: requirement.name,
      status: "INVALID",
      present,
      redacted: true,
      reason: "environment variable name is invalid"
    };
  }

  if (DANGEROUS_LOADER_VARIABLES.has(requirement.name)) {
    return {
      name: requirement.name,
      status: "DENIED",
      present,
      redacted: true,
      reason: "dangerous loader environment variable is denied"
    };
  }

  let declaredPattern: RegExp | undefined;
  if (requirement.pattern !== undefined) {
    try {
      declaredPattern = new RegExp(requirement.pattern);
    } catch {
      return {
        name: requirement.name,
        status: "INVALID",
        present,
        redacted: true,
        reason: "declared pattern is invalid"
      };
    }
  }

  if (!present) {
    return requirement.required === false
      ? {
          name: requirement.name,
          status: "PASS",
          present: false,
          redacted: true,
          reason: "optional environment variable is not present"
        }
      : {
          name: requirement.name,
          status: "MISSING",
          present: false,
          redacted: true,
          reason: "required environment variable is missing"
        };
  }

  if (value === "" && requirement.allowEmpty !== true) {
    return {
      name: requirement.name,
      status: "INVALID",
      present: true,
      redacted: true,
      reason: "empty environment value is not allowed"
    };
  }

  if (requirement.allowedValues !== undefined && !requirement.allowedValues.includes(value)) {
    return {
      name: requirement.name,
      status: "INVALID",
      present: true,
      redacted: true,
      reason: "value is not in the declared allowlist"
    };
  }

  if (declaredPattern !== undefined && !declaredPattern.test(value)) {
    return {
      name: requirement.name,
      status: "INVALID",
      present: true,
      redacted: true,
      reason: "value does not match the declared pattern"
    };
  }

  return {
    name: requirement.name,
    status: "PASS",
    present: true,
    redacted: true
  };
}

export function checkEnvironmentPrerequisites(
  requirements: readonly EnvironmentRequirement[],
  environment: Readonly<Record<string, string | undefined>>
): EnvironmentCheckResult {
  const checks = [...requirements]
    .sort((left, right) => compareNames(left.name, right.name))
    .map((requirement) => checkRequirement(requirement, environment));
  const allowedNames = checks
    .filter((check) => check.status === "PASS" && check.present)
    .map((check) => check.name);

  return {
    valid: checks.every((check) => check.status === "PASS"),
    allowedNames,
    checks
  };
}
