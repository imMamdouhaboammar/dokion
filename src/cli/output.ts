import { DokionError } from "../core/errors.ts";
import type { CliOutputFormat } from "./types.ts";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
}

function renderScalar(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value.includes("\n") ? JSON.stringify(value) : value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return JSON.stringify(stableValue(value));
}

function renderHuman(value: unknown): string {
  const stable = stableValue(value);
  if (Array.isArray(stable)) {
    if (stable.length === 0) return "[]";
    return stable.map((item) => `- ${renderScalar(item)}`).join("\n");
  }
  if (stable && typeof stable === "object") {
    const entries = Object.entries(stable as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries.map(([key, item]) => `${key}: ${renderScalar(item)}`).join("\n");
  }
  return renderScalar(stable);
}

export function renderCliResult(value: unknown, format: CliOutputFormat): string {
  const stable = stableValue(value);
  return format === "json" ? JSON.stringify(stable, null, 2) : renderHuman(stable);
}

export function writeCliResult(value: unknown, format: CliOutputFormat): void {
  console.log(renderCliResult(value, format));
}

function diagnosticPayload(error: unknown): Record<string, unknown> {
  if (error instanceof DokionError) {
    return { error: error.code, message: error.message, details: error.details };
  }
  return {
    error: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : String(error),
    details: {}
  };
}

export function renderCliDiagnostic(error: unknown, format: CliOutputFormat): string {
  const payload = diagnosticPayload(error);
  if (format === "json") return renderCliResult(payload, "json");
  const details = payload.details as Record<string, unknown>;
  const lines = [`${String(payload.error)}: ${String(payload.message)}`];
  for (const [key, value] of Object.entries(stableValue(details) as Record<string, unknown>)) {
    lines.push(`${key}: ${renderScalar(value)}`);
  }
  return lines.join("\n");
}

export function writeCliDiagnostic(error: unknown, format: CliOutputFormat): void {
  console.error(renderCliDiagnostic(error, format));
}
