import { DokionError } from "../core/errors.ts";

export type EnvironmentPolicyDegradation =
  | "PATH_FALLBACK_APPLIED"
  | "DECLARED_ENVIRONMENT_VARIABLE_DENIED"
  | "UNPROVEN_PLATFORM_ENVIRONMENT_POLICY";

export interface ChildEnvironmentInput {
  platform: string;
  parentEnvironment: Readonly<Record<string, string | undefined>>;
  declaredNames: readonly string[];
  runtimeValues?: Readonly<Record<string, string>>;
}

export interface EnvironmentRedactionToken {
  name: string;
  token: string;
}

export interface SupportedChildEnvironment {
  supported: true;
  platform: string;
  environment: Record<string, string>;
  inheritedNames: string[];
  runtimeNames: string[];
  missingDeclaredNames: string[];
  deniedNames: string[];
  redactions: EnvironmentRedactionToken[];
  degradations: EnvironmentPolicyDegradation[];
}

export interface UnsupportedChildEnvironment {
  supported: false;
  platform: string;
  reason: string;
  degradations: ["UNPROVEN_PLATFORM_ENVIRONMENT_POLICY"];
}

export type ChildEnvironmentResult = SupportedChildEnvironment | UnsupportedChildEnvironment;

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]*$/;
const RUNTIME_NAME = /^DOKION_[A-Z0-9_]+$/;
const SAFE_DEFAULT_NAMES = ["LANG", "LC_ALL", "LC_CTYPE", "PATH", "TEMP", "TMP", "TMPDIR", "TZ"] as const;
const DANGEROUS_NAMES = new Set([
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

function invalid(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Child environment policy is invalid: ${reason}`, { field });
}

function requireName(field: string, name: string): string {
  if (!ENVIRONMENT_NAME.test(name)) invalid(field, `environment variable name ${name} is invalid`);
  return name;
}

function requireValue(field: string, value: string): string {
  if (value.includes("\u0000")) invalid(field, `${field} contains a null byte`);
  return value;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function redaction(name: string): EnvironmentRedactionToken {
  return { name, token: `[REDACTED:ENV:${name}]` };
}

function sortedEnvironment(values: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0));
}

export function buildChildEnvironment(input: ChildEnvironmentInput): ChildEnvironmentResult {
  if (!SUPPORTED_PLATFORMS.has(input.platform)) {
    return {
      supported: false,
      platform: input.platform,
      reason: `No proven child environment policy exists for platform ${input.platform}`,
      degradations: ["UNPROVEN_PLATFORM_ENVIRONMENT_POLICY"]
    };
  }

  const declaredNames = sortedUnique(input.declaredNames.map((name, index) =>
    requireName(`declaredNames[${index}]`, name)));
  const runtimeEntries = Object.entries(input.runtimeValues ?? {}).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0);

  for (const [name, value] of runtimeEntries) {
    if (!RUNTIME_NAME.test(name)) invalid(`runtimeValues.${name}`, "runtime values must use the DOKION_ namespace");
    if (declaredNames.includes(name)) invalid(`runtimeValues.${name}`, "runtime value overlaps a declared environment variable");
    requireValue(`runtimeValues.${name}`, value);
  }

  const environment: Record<string, string> = {};
  const inheritedNames: string[] = [];
  const runtimeNames: string[] = [];
  const missingDeclaredNames: string[] = [];
  const deniedNames: string[] = [];
  const redactions: EnvironmentRedactionToken[] = [];
  const degradations: EnvironmentPolicyDegradation[] = [];

  for (const name of SAFE_DEFAULT_NAMES) {
    const value = input.parentEnvironment[name];
    if (value === undefined) continue;
    environment[name] = requireValue(`parentEnvironment.${name}`, value);
    inheritedNames.push(name);
  }

  if (environment.PATH === undefined) {
    environment.PATH = "/usr/bin:/bin";
    inheritedNames.push("PATH");
    degradations.push("PATH_FALLBACK_APPLIED");
  }

  for (const name of declaredNames) {
    if (DANGEROUS_NAMES.has(name)) {
      deniedNames.push(name);
      continue;
    }
    const value = input.parentEnvironment[name];
    if (value === undefined) {
      missingDeclaredNames.push(name);
      continue;
    }
    environment[name] = requireValue(`parentEnvironment.${name}`, value);
    if (!inheritedNames.includes(name)) inheritedNames.push(name);
    redactions.push(redaction(name));
  }

  for (const [name, value] of runtimeEntries) {
    environment[name] = value;
    runtimeNames.push(name);
    redactions.push(redaction(name));
  }

  if (deniedNames.length > 0) degradations.push("DECLARED_ENVIRONMENT_VARIABLE_DENIED");

  return {
    supported: true,
    platform: input.platform,
    environment: sortedEnvironment(environment),
    inheritedNames: sortedUnique(inheritedNames),
    runtimeNames: sortedUnique(runtimeNames),
    missingDeclaredNames: sortedUnique(missingDeclaredNames),
    deniedNames: sortedUnique(deniedNames),
    redactions: redactions.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
    degradations
  };
}
