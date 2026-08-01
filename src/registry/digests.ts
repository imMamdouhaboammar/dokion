import { createHash } from "node:crypto";

import { DokionError } from "../core/errors.ts";

export function compareUtf8Bytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Canonical JSON cannot contain a non-finite number.");
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => compareUtf8Bytes(left, right))
        .map(([key, item]) => [key, canonicalValue(item)])
    );
  }
  throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Canonical JSON contains an unsupported value type.", {
    valueType: typeof value
  });
}

export function canonicalJsonBytes(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(canonicalValue(value), null, 2)}\n`, "utf8");
}

export function sha256Digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

interface ParsedSemver {
  core: readonly [number, number, number];
  prerelease: readonly string[] | null;
}

function parseExactSemver(value: string): ParsedSemver {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", `Invalid exact semantic version: ${value}`, {
      version: value
    });
  }

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? null : match[4].split(".")
  };
}

function comparePrereleaseIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const leftNumber = BigInt(left);
    const rightNumber = BigInt(right);
    return leftNumber === rightNumber ? 0 : leftNumber < rightNumber ? -1 : 1;
  }
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return compareUtf8Bytes(left, right);
}

export function compareExactSemver(left: string, right: string): number {
  const leftVersion = parseExactSemver(left);
  const rightVersion = parseExactSemver(right);

  for (let index = 0; index < leftVersion.core.length; index += 1) {
    const leftPart = leftVersion.core[index]!;
    const rightPart = rightVersion.core[index]!;
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }

  if (leftVersion.prerelease === null || rightVersion.prerelease === null) {
    if (leftVersion.prerelease === rightVersion.prerelease) return 0;
    return leftVersion.prerelease === null ? 1 : -1;
  }

  const comparedIdentifiers = Math.min(leftVersion.prerelease.length, rightVersion.prerelease.length);
  for (let index = 0; index < comparedIdentifiers; index += 1) {
    const comparison = comparePrereleaseIdentifier(
      leftVersion.prerelease[index]!,
      rightVersion.prerelease[index]!
    );
    if (comparison !== 0) return comparison;
  }

  if (leftVersion.prerelease.length === rightVersion.prerelease.length) return 0;
  return leftVersion.prerelease.length < rightVersion.prerelease.length ? -1 : 1;
}
