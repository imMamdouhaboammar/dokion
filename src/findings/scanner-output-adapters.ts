import { DokionError } from "../core/errors.ts";
import type { FindingSeverity, RawFinding, RawFindingEnvelope } from "./types.ts";

export type NativeScannerAdapter =
  | "OSV_SCANNER_JSON"
  | "GITLEAKS_JSON"
  | "SEMGREP_JSON"
  | "TRIVY_JSON";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown): JsonObject | undefined {
  return isObject(value) ? value : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function array(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function strings(value: unknown): string[] {
  return (array(value) ?? []).flatMap((item) => {
    const parsed = string(item);
    return parsed ? [parsed] : [];
  });
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function severity(value: unknown, fallback: FindingSeverity = "INFO"): FindingSeverity {
  const normalized = string(value)?.toUpperCase();
  if (normalized === "CRITICAL") return "CRITICAL";
  if (normalized === "HIGH" || normalized === "ERROR") return "HIGH";
  if (normalized === "MEDIUM" || normalized === "MODERATE" || normalized === "WARNING" || normalized === "WARN") return "MEDIUM";
  if (normalized === "LOW") return "LOW";
  if (normalized === "INFO" || normalized === "INFORMATIONAL" || normalized === "UNKNOWN") return "INFO";
  return fallback;
}

function blocksRelease(value: FindingSeverity): boolean {
  return value === "CRITICAL" || value === "HIGH";
}

function invalid(format: NativeScannerAdapter, reason: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("INVALID_STATE", `${format.replaceAll("_", " ")} is invalid: ${reason}`, details);
}

export function resolveNativeScannerAdapter(capabilityId: string): NativeScannerAdapter | null {
  switch (capabilityId.trim().toLowerCase()) {
    case "osv-scanner":
      return "OSV_SCANNER_JSON";
    case "gitleaks":
      return "GITLEAKS_JSON";
    case "semgrep":
      return "SEMGREP_JSON";
    case "trivy":
      return "TRIVY_JSON";
    default:
      return null;
  }
}

export function nativeScannerAcceptsExitCode(capabilityId: string, exitCode: number): boolean {
  const adapter = resolveNativeScannerAdapter(capabilityId);
  if (!adapter) return exitCode === 0;
  if (adapter === "OSV_SCANNER_JSON" || adapter === "GITLEAKS_JSON" || adapter === "TRIVY_JSON") {
    return exitCode === 0 || exitCode === 1;
  }
  return exitCode === 0;
}

function adaptOsv(payload: unknown): RawFindingEnvelope {
  const root = object(payload);
  const results = array(root?.results);
  if (!root || !results) invalid("OSV_SCANNER_JSON", "results must be an array");

  const findings: RawFinding[] = [];
  for (const resultValue of results) {
    const result = object(resultValue);
    if (!result) continue;
    const sourcePath = string(object(result.source)?.path);
    for (const packageValue of array(result.packages) ?? []) {
      const packageResult = object(packageValue);
      const packageInfo = object(packageResult?.package);
      if (!packageResult || !packageInfo) continue;
      const packageName = string(packageInfo.name) ?? "unknown package";
      const packageVersion = string(packageInfo.version);
      const ecosystem = string(packageInfo.ecosystem);

      for (const vulnerabilityValue of array(packageResult.vulnerabilities) ?? []) {
        const vulnerability = object(vulnerabilityValue);
        const id = string(vulnerability?.id);
        if (!vulnerability || !id) continue;
        const findingSeverity = severity(object(vulnerability.database_specific)?.severity);
        const summary = string(vulnerability.summary);
        const details = string(vulnerability.details);
        const packageLabel = packageVersion ? `${packageName}@${packageVersion}` : packageName;
        const descriptionParts = [
          `Affected dependency: ${packageLabel}${ecosystem ? ` (${ecosystem})` : ""}.`,
          details,
          strings(vulnerability.aliases).length > 0
            ? `Aliases: ${strings(vulnerability.aliases).join(", ")}.`
            : undefined,
        ].filter((part): part is string => Boolean(part));

        findings.push({
          severity: findingSeverity,
          title: summary ? `${id}: ${summary}` : `${id} affects ${packageLabel}`,
          description: descriptionParts.join(" "),
          rule_id: id,
          ...(sourcePath ? { location: { file: sourcePath } } : {}),
          blocks_release: blocksRelease(findingSeverity),
          tags: unique(["dependency", ecosystem, packageName, ...strings(vulnerability.aliases)]),
        });
      }
    }
  }
  return { version: 1, findings };
}

function adaptGitleaks(payload: unknown): RawFindingEnvelope {
  const entries = array(payload);
  if (!entries) invalid("GITLEAKS_JSON", "root must be an array");

  const findings: RawFinding[] = [];
  for (const entryValue of entries) {
    const entry = object(entryValue);
    if (!entry) continue;
    const ruleId = string(entry.RuleID) ?? "gitleaks-secret";
    const description = string(entry.Description) ?? "Potential secret detected";
    const file = string(entry.File);
    const line = finiteNumber(entry.StartLine);
    const endLine = finiteNumber(entry.EndLine);
    const commit = string(entry.Commit);
    const fingerprint = string(entry.Fingerprint);
    const metadata = [
      commit ? `Commit: ${commit}.` : undefined,
      fingerprint ? `Fingerprint: ${fingerprint}.` : undefined,
    ].filter((part): part is string => Boolean(part)).join(" ");

    findings.push({
      severity: "HIGH",
      title: description,
      ...(metadata ? { description: metadata } : {}),
      rule_id: ruleId,
      ...(file || line !== undefined
        ? { location: { ...(file ? { file } : {}), ...(line !== undefined ? { line } : {}), ...(endLine !== undefined ? { end_line: endLine } : {}) } }
        : {}),
      blocks_release: true,
      tags: unique(["secret", ruleId, ...strings(entry.Tags)]),
    });
  }
  return { version: 1, findings };
}

function metadataTags(value: unknown): string[] {
  const metadata = object(value);
  if (!metadata) return [];
  const tags: string[] = [];
  for (const key of ["cwe", "owasp", "category", "technology", "confidence"] as const) {
    const item = metadata[key];
    const values = Array.isArray(item) ? strings(item) : [string(item)].filter((entry): entry is string => Boolean(entry));
    tags.push(...values);
  }
  return unique(tags);
}

function adaptSemgrep(payload: unknown): RawFindingEnvelope {
  const root = object(payload);
  const results = array(root?.results);
  if (!root || !results) invalid("SEMGREP_JSON", "results must be an array");

  const findings: RawFinding[] = [];
  for (const resultValue of results) {
    const result = object(resultValue);
    const extra = object(result?.extra);
    if (!result || !extra) continue;
    const ruleId = string(result.check_id) ?? "semgrep-finding";
    const message = string(extra.message) ?? ruleId;
    const findingSeverity = severity(extra.severity, "MEDIUM");
    const file = string(result.path);
    const line = finiteNumber(object(result.start)?.line);
    const endLine = finiteNumber(object(result.end)?.line);

    findings.push({
      severity: findingSeverity,
      title: message.split("\n", 1)[0] ?? ruleId,
      description: message,
      rule_id: ruleId,
      ...(file || line !== undefined
        ? { location: { ...(file ? { file } : {}), ...(line !== undefined ? { line } : {}), ...(endLine !== undefined ? { end_line: endLine } : {}) } }
        : {}),
      blocks_release: blocksRelease(findingSeverity),
      tags: unique(["sast", ...metadataTags(extra.metadata)]),
    });
  }
  return { version: 1, findings };
}

function trivyLocation(target: string | undefined, entry: JsonObject): RawFinding["location"] | undefined {
  const cause = object(entry.CauseMetadata);
  const file = string(cause?.Resource) ?? target;
  const line = finiteNumber(cause?.StartLine) ?? finiteNumber(entry.StartLine);
  const endLine = finiteNumber(cause?.EndLine) ?? finiteNumber(entry.EndLine);
  if (!file && line === undefined) return undefined;
  return {
    ...(file ? { file } : {}),
    ...(line !== undefined ? { line } : {}),
    ...(endLine !== undefined ? { end_line: endLine } : {}),
  };
}

function adaptTrivy(payload: unknown): RawFindingEnvelope {
  const root = object(payload);
  if (!root) invalid("TRIVY_JSON", "root must be an object");
  if (string(root.bomFormat) === "CycloneDX") return { version: 1, findings: [] };
  const results = array(root.Results);
  if (!results) invalid("TRIVY_JSON", "Results must be an array or bomFormat must be CycloneDX");

  const findings: RawFinding[] = [];
  for (const resultValue of results) {
    const result = object(resultValue);
    if (!result) continue;
    const target = string(result.Target);

    for (const itemValue of array(result.Vulnerabilities) ?? []) {
      const item = object(itemValue);
      const ruleId = string(item?.VulnerabilityID);
      if (!item || !ruleId) continue;
      const findingSeverity = severity(item.Severity, "MEDIUM");
      const packageName = string(item.PkgName);
      const installed = string(item.InstalledVersion);
      const fixed = string(item.FixedVersion);
      const description = [
        string(item.Description),
        packageName ? `Package: ${packageName}${installed ? `@${installed}` : ""}.` : undefined,
        fixed ? `Fixed version: ${fixed}.` : undefined,
      ].filter((part): part is string => Boolean(part)).join(" ");
      findings.push({
        severity: findingSeverity,
        title: string(item.Title) ?? `${ruleId}${packageName ? ` affects ${packageName}` : ""}`,
        ...(description ? { description } : {}),
        rule_id: ruleId,
        ...(target ? { location: { file: target, ...(string(item.PrimaryURL) ? { url: string(item.PrimaryURL)! } : {}) } } : {}),
        ...(fixed ? { proposed_fix: { summary: `Upgrade to ${fixed}`, risk: "LOW" as const, effort: "SMALL" as const } } : {}),
        blocks_release: blocksRelease(findingSeverity),
        tags: unique(["dependency", packageName]),
      });
    }

    for (const itemValue of array(result.Misconfigurations) ?? []) {
      const item = object(itemValue);
      const ruleId = string(item?.ID);
      if (!item || !ruleId) continue;
      const findingSeverity = severity(item.Severity, "MEDIUM");
      findings.push({
        severity: findingSeverity,
        title: string(item.Title) ?? ruleId,
        ...(string(item.Description) ? { description: string(item.Description)! } : {}),
        rule_id: ruleId,
        ...(trivyLocation(target, item) ? { location: trivyLocation(target, item)! } : {}),
        ...(string(item.Resolution) ? { proposed_fix: { summary: string(item.Resolution)! } } : {}),
        blocks_release: blocksRelease(findingSeverity),
        tags: ["misconfiguration"],
      });
    }

    for (const itemValue of array(result.Secrets) ?? []) {
      const item = object(itemValue);
      const ruleId = string(item?.RuleID) ?? "trivy-secret";
      if (!item) continue;
      const findingSeverity = severity(item.Severity, "HIGH");
      findings.push({
        severity: findingSeverity,
        title: string(item.Title) ?? "Potential secret detected",
        rule_id: ruleId,
        ...(trivyLocation(target, item) ? { location: trivyLocation(target, item)! } : {}),
        blocks_release: true,
        tags: ["secret", ruleId],
      });
    }
  }
  return { version: 1, findings };
}

export function adaptNativeScannerOutput(capabilityId: string, payload: unknown): RawFindingEnvelope {
  const adapter = resolveNativeScannerAdapter(capabilityId);
  if (!adapter) {
    throw new DokionError("UNSUPPORTED_EXECUTION", `No native scanner adapter is registered for ${capabilityId}`, {
      capabilityId,
    });
  }

  switch (adapter) {
    case "OSV_SCANNER_JSON":
      return adaptOsv(payload);
    case "GITLEAKS_JSON":
      return adaptGitleaks(payload);
    case "SEMGREP_JSON":
      return adaptSemgrep(payload);
    case "TRIVY_JSON":
      return adaptTrivy(payload);
  }
}
