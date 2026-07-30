import type { AgentPlatform } from "../platform/types.ts";

export type CapabilityConflictType =
  | "INCOMPATIBLE_VERSIONS"
  | "DUPLICATE_RESPONSIBILITY"
  | "OVERLAPPING_PARALLEL_WRITES"
  | "PLATFORM_INCOMPATIBLE";

export interface CapabilityDeclaration {
  id: string;
  stepId: string;
  stageId: string;
  stageExecution: "SEQUENTIAL" | "PARALLEL";
  responsibility: string;
  version?: string;
  writeScopes?: readonly string[];
  platforms?: readonly AgentPlatform[];
}

export interface CapabilityConflict {
  type: CapabilityConflictType;
  blocking: true;
  capabilityIds: string[];
  stepIds: string[];
  detail: string;
}

const TYPE_ORDER: Readonly<Record<CapabilityConflictType, number>> = {
  INCOMPATIBLE_VERSIONS: 0,
  DUPLICATE_RESPONSIBILITY: 1,
  OVERLAPPING_PARALLEL_WRITES: 2,
  PLATFORM_INCOMPATIBLE: 3
};

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function normalizedResponsibility(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function displayResponsibility(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;
  return `${normalized[0]!.toUpperCase()}${normalized.slice(1).toLocaleLowerCase("en-US")}`;
}

function normalizedScope(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function fixedPrefix(pattern: string): string {
  const wildcard = pattern.search(/[?*]/);
  return wildcard === -1 ? pattern : pattern.slice(0, wildcard);
}

function fixedSuffix(pattern: string): string {
  const wildcard = Math.max(pattern.lastIndexOf("*"), pattern.lastIndexOf("?"));
  return wildcard === -1 ? pattern : pattern.slice(wildcard + 1);
}

function globRegex(pattern: string): RegExp {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]!;
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

function scopesOverlap(leftValue: string, rightValue: string): boolean {
  const left = normalizedScope(leftValue);
  const right = normalizedScope(rightValue);
  if (!left || !right) return false;
  if (left === right || left === "*" || left === "**" || right === "*" || right === "**") return true;

  const leftHasWildcard = /[?*]/.test(left);
  const rightHasWildcard = /[?*]/.test(right);
  if (leftHasWildcard && !rightHasWildcard && globRegex(left).test(right)) return true;
  if (!leftHasWildcard && rightHasWildcard && globRegex(right).test(left)) return true;
  if (!leftHasWildcard || !rightHasWildcard) return false;

  const leftPrefix = fixedPrefix(left);
  const rightPrefix = fixedPrefix(right);
  const prefixesCompatible = leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
  if (!prefixesCompatible) return false;

  const leftSuffix = fixedSuffix(left);
  const rightSuffix = fixedSuffix(right);
  return leftSuffix === ""
    || rightSuffix === ""
    || leftSuffix.endsWith(rightSuffix)
    || rightSuffix.endsWith(leftSuffix);
}

function versionConflicts(capabilities: readonly CapabilityDeclaration[]): CapabilityConflict[] {
  const byId = new Map<string, CapabilityDeclaration[]>();
  for (const capability of capabilities) {
    const group = byId.get(capability.id) ?? [];
    group.push(capability);
    byId.set(capability.id, group);
  }

  const conflicts: CapabilityConflict[] = [];
  for (const [id, declarations] of byId) {
    const versions = sortedUnique(
      declarations.flatMap((declaration) => declaration.version ? [declaration.version] : [])
    );
    if (versions.length < 2) continue;
    conflicts.push({
      type: "INCOMPATIBLE_VERSIONS",
      blocking: true,
      capabilityIds: [id],
      stepIds: sortedUnique(declarations.map((declaration) => declaration.stepId)),
      detail: `Capability ${id} declares incompatible versions: ${versions.join(", ")}`
    });
  }
  return conflicts;
}

function responsibilityConflicts(capabilities: readonly CapabilityDeclaration[]): CapabilityConflict[] {
  const byResponsibility = new Map<string, CapabilityDeclaration[]>();
  for (const capability of capabilities) {
    const normalized = normalizedResponsibility(capability.responsibility);
    if (!normalized) continue;
    const group = byResponsibility.get(normalized) ?? [];
    group.push(capability);
    byResponsibility.set(normalized, group);
  }

  const conflicts: CapabilityConflict[] = [];
  for (const declarations of byResponsibility.values()) {
    const capabilityIds = sortedUnique(declarations.map((declaration) => declaration.id));
    if (capabilityIds.length < 2) continue;
    conflicts.push({
      type: "DUPLICATE_RESPONSIBILITY",
      blocking: true,
      capabilityIds,
      stepIds: sortedUnique(declarations.map((declaration) => declaration.stepId)),
      detail: `Multiple capabilities declare the same responsibility: ${displayResponsibility(declarations[0]!.responsibility)}`
    });
  }
  return conflicts;
}

function writeScopeConflicts(capabilities: readonly CapabilityDeclaration[]): CapabilityConflict[] {
  const conflicts: CapabilityConflict[] = [];
  for (let leftIndex = 0; leftIndex < capabilities.length; leftIndex += 1) {
    const left = capabilities[leftIndex]!;
    if (left.stageExecution !== "PARALLEL") continue;
    for (let rightIndex = leftIndex + 1; rightIndex < capabilities.length; rightIndex += 1) {
      const right = capabilities[rightIndex]!;
      if (right.stageExecution !== "PARALLEL" || left.stageId !== right.stageId) continue;

      const overlap = (left.writeScopes ?? []).flatMap((leftScope) =>
        (right.writeScopes ?? [])
          .filter((rightScope) => scopesOverlap(leftScope, rightScope))
          .map((rightScope) => sortedUnique([normalizedScope(leftScope), normalizedScope(rightScope)]))
      )[0];
      if (!overlap) continue;

      const stepIds = sortedUnique([left.stepId, right.stepId]);
      conflicts.push({
        type: "OVERLAPPING_PARALLEL_WRITES",
        blocking: true,
        capabilityIds: sortedUnique([left.id, right.id]),
        stepIds,
        detail: `Parallel steps ${stepIds[0]} and ${stepIds[1]} have overlapping write scopes: ${overlap[0]} <> ${overlap[1]}`
      });
    }
  }
  return conflicts;
}

function platformConflicts(
  capabilities: readonly CapabilityDeclaration[],
  platform: AgentPlatform
): CapabilityConflict[] {
  return capabilities
    .filter((capability) => capability.platforms !== undefined && !capability.platforms.includes(platform))
    .map((capability) => ({
      type: "PLATFORM_INCOMPATIBLE" as const,
      blocking: true as const,
      capabilityIds: [capability.id],
      stepIds: [capability.stepId],
      detail: `Capability ${capability.id} does not declare support for platform ${platform}`
    }));
}

function compareConflicts(left: CapabilityConflict, right: CapabilityConflict): number {
  const typeDifference = TYPE_ORDER[left.type] - TYPE_ORDER[right.type];
  if (typeDifference !== 0) return typeDifference;
  const leftSteps = left.stepIds.join("\0");
  const rightSteps = right.stepIds.join("\0");
  if (leftSteps !== rightSteps) return leftSteps < rightSteps ? -1 : 1;
  const leftCapabilities = left.capabilityIds.join("\0");
  const rightCapabilities = right.capabilityIds.join("\0");
  return leftCapabilities < rightCapabilities ? -1 : leftCapabilities > rightCapabilities ? 1 : 0;
}

export function detectCapabilityConflicts(
  capabilities: readonly CapabilityDeclaration[],
  platform: AgentPlatform
): CapabilityConflict[] {
  return [
    ...versionConflicts(capabilities),
    ...responsibilityConflicts(capabilities),
    ...writeScopeConflicts(capabilities),
    ...platformConflicts(capabilities, platform)
  ].sort(compareConflicts);
}
