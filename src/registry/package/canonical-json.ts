import { DokionError } from "../../core/errors.ts";

type CanonicalJsonValue = null | boolean | number | string | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue };

function normalize(value: unknown, path: string): CanonicalJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DokionError("PACKAGE_MANIFEST_INVALID", "Canonical JSON cannot represent a non-finite number", {
        path,
        value: String(value)
      });
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalize(item, `${path}/${index}`));
  }

  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new DokionError("PACKAGE_MANIFEST_INVALID", "Canonical JSON accepts plain objects only", {
        path,
        constructor: prototype?.constructor?.name
      });
    }

    const output: { [key: string]: CanonicalJsonValue } = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child === undefined || typeof child === "function" || typeof child === "symbol" || typeof child === "bigint") {
        throw new DokionError("PACKAGE_MANIFEST_INVALID", "Canonical JSON contains an unsupported value", {
          path: `${path}/${key}`,
          type: typeof child
        });
      }
      output[key] = normalize(child, `${path}/${key}`);
    }
    return output;
  }

  throw new DokionError("PACKAGE_MANIFEST_INVALID", "Canonical JSON contains an unsupported value", {
    path,
    type: typeof value
  });
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(normalize(value, ""))}\n`;
}
