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

export function compareExactSemver(left: string, right: string): number {
  const parse = (value: string): [number, number, number] => {
    const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+].*)?$/.exec(value);
    if (!match) {
      throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", `Invalid exact semantic version: ${value}`, {
        version: value
      });
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };

  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index]! - rightParts[index]!;
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}
