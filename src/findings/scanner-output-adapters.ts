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

function requireObject(
  format: NativeScannerAdapter,
  value: unknown,
  reason: string,
  details: Record<string, unknown>
): JsonObject {
  const parsed = object(value);
  if (!parsed) invalid(format, reason, details);
  return parsed;
}

function requireArray(
  format: NativeScannerAdapter,
  value: unknown,
  reason: string,
  details: Record<string, unknown>
): unknown[] {
  const parsed = array(value);
  if (!parsed) invalid(format, reason, details);
  return parsed;
}

function optionalArray(
  format: NativeScannerAdapter,
  owner: JsonObject,
  key: string,
  details: Record<string, unknown>
): unknown[] {
  if (owner[key] === undefined) return [];
  return requireArray(format, owner[key], `${key} must be an array`, details);
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
  for (const [resultIndex, resultValue] of results.entries()) {
    const result = requireObject(
      "OSV_SCANNER_JSON",
      resultValue,
      "result must be an object",
      { resultIndex }
    );
    const source = result.source === undefined
      ? undefined
      : requireObject("OSV_SCANNER_JSON", result.source, "source must be an object", { resultIndex });
    const sourcePath = string(source?.path);
    const packages = requireArray(
      "OSV_SCANNER_JSON",
      result.packages,
      "packages must be an array",
      { resultIndex }
    );

    for (const [packageIndex, packageValue] of packages.entries()) {
      const packageResult = requireObject(
        "OSV_SCANNER_JSON",
        packageValue,
        "package result must be an object",
        { resultIndex, packageIndex }
      );
      const packageInfo = requireObject(
        "OSV_SCANNER_JSON",
        packageResult.package,
        "package metadata must be an object",
        { resultIndex, packageIndex }
      );
      const packageName = string(packageInfo.name);
      if (!packageName) {
        invalid("OSV_SCANNER_JSON", "package name is required", { resultIndex, packageIndex });
      }
      const packageVersion = string(packageInfo.version);
      const ecosystem = string(packageInfo.ecosystem);
      const vulnerabilities = requireArray(
        "OSV_SCANNER_JSON",
        packageResult.vulnerabilities,
        "vulnerabilities must be an array",
        { resultIndex, packageIndex }
      );

      for (const [vulnerabilityIndex, vulnerabilityValue] of vulnerabilities.entries()) {
        const vulnerability = requireObject(
          "OSV_SCANNER_JSON",
          vulnerabilityValue,
          "vulnerability must be an object",
          { resultIndex, packageIndex, vulnerabilityIndex }
        );
        const id = string(vulnerability.id);
        if (!id) {
          invalid("OSV_SCANNER_JSON", "vulnerability id is required", {
            resultIndex,
            packageIndex,
            vulnerabilityIndex,
          });
        }
        const databaseSpecific = vulnerability.database_specific === undefined
          ? undefined
          : requireObject(
              "OSV_SCANNER_JSON",
              vulnerability.database_specific,
              "database_specific must be an object",
              { resultIndex, packageIndex, vulnerabilityIndex }
            );
        const findingSeverity = severity(databaseSpecific?.severity);
        const summary = string(vulnerability.summary);
        const details = string(vulnerability.details);
        const packageLabel = packageVersion ? `${packageName}@${packageVersion}` : packageName;
        const aliases = strings(vulnerability.aliases);
        const descriptionParts = [
          `Affected dependency: ${packageLabel}${ecosystem ? ` (${ecosystem})` : ""}.`,
          details,
          aliases.length > 0 ? `Aliases: ${aliases.join(", ")}.` : undefined,
        ].filter((part): part is string => Boolean(part));

        findings.push({
          severity: findingSeverity,
          title: summary ? `${id}: ${summary}` : `${id} affects ${packageLabel}`,
          description: descriptionParts.join(" "),
          rule_id: id,
          ...(sourcePath ? { location: { file: sourcePath } } : {}),
          blocks_release: blocksRelease(findingSeverity),
          tags: unique(["dependency", ecosystem, packageName, ...aliases]),
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
  for (const [entryIndex, entryValue] of entries.entries()) {
    const entry = requireObject(
      "GITLEAKS_JSON",
      entryValue,
      "finding must be an object",
      { entryIndex }
    );
    const ruleId = string(entry.RuleID);
    const description = string(entry.Description);
    if (!ruleId || !description) {
      invalid("GITLEAKS_JSON", "RuleID and Description are required", { entryIndex });
    }
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
  for (const [resultIndex, resultValue] of results.entries()) {
    const result = requireObject(
      "SEMGREP_JSON",
      resultValue,
      "result must be an object",
      { resultIndex }
    );
    const extra = requireObject(
      "SEMGREP_JSON",
      result.extra,
      "extra must be an object",
      { resultIndex }
    );
    const ruleId = string(result.check_id);
    const message = string(extra.message);
    const file = string(result.path);
    if (!ruleId || !message || !file) {
      invalid("SEMGREP_JSON", "check_id, path, and extra.message are required", { resultIndex });
    }
    const start = result.start === undefined
      ? undefined
      : requireObject("SEMGREP_JSON", result.start, "start must be an object", { resultIndex });
    const end = result.end === undefined
      ? undefined
      : requireObject("SEMGREP_JSON", result.end, "end must be an object", { resultIndex });
    const findingSeverity = severity(extra.severity, "MEDIUM");
    const line = finiteNumber(start?.line);
    const endLine = finiteNumber(end?.line);

    findings.push({
      severity: findingSeverity,
      title: message.split("\n", 1)[0] ?? ruleId,
      description: message,
      rule_id: ruleId,
      location: {
        file,
        ...(line !== undefined ? { line } : {}),
        ...(endLine !== undefined ? { end_line: endLine } : {}),
      },
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
  if (string(root.bomFormat) === "CycloneDX") {
    requireArray("TRIVY_JSON", root.components, "components must be an array", {});
    return { version: 1, findings: [] };
  }
  const results = array(root.Results);
  if (!results) invalid("TRIVY_JSON", "Results must be an array or bomFormat must be CycloneDX");

  const findings: RawFinding[] = [];
  for (const [resultIndex, resultValue] of results.entries()) {
    const result = requireObject(
      "TRIVY_JSON",
      resultValue,
      "result must be an object",
      { resultIndex }
    );
    const target = string(result.Target);

    for (const [itemIndex, itemValue] of optionalArray("TRIVY_JSON", result, "Vulnerabilities", { resultIndex }).entries()) {
      const item = requireObject(
        "TRIVY_JSON",
        itemValue,
        "vulnerability must be an object",
        { resultIndex, itemIndex }
      );
      const ruleId = string(item.VulnerabilityID);
      if (!ruleId) {
        invalid("TRIVY_JSON", "VulnerabilityID is required", { resultIndex, itemIndex });
      }
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

    for (const [itemIndex, itemValue] of optionalArray("TRIVY_JSON", result, "Misconfigurations", { resultIndex }).entries()) {
      const item = requireObject(
        "TRIVY_JSON",
        itemValue,
        "misconfiguration must be an object",
        { resultIndex, itemIndex }
      );
      const ruleId = string(item.ID);
      if (!ruleId) {
        invalid("TRIVY_JSON", "misconfiguration ID is required", { resultIndex, itemIndex });
      }
      if (item.CauseMetadata !== undefined) {
        requireObject(
          "TRIVY_JSON",
          item.CauseMetadata,
          "CauseMetadata must be an object",
          { resultIndex, itemIndex }
        );
      }
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

    for (const [itemIndex, itemValue] of optionalArray("TRIVY_JSON", result, "Secrets", { resultIndex }).entries()) {
      const item = requireObject(
        "TRIVY_JSON",
        itemValue,
        "secret finding must be an object",
        { resultIndex, itemIndex }
      );
      const ruleId = string(item.RuleID);
      if (!ruleId) {
        invalid("TRIVY_JSON", "secret RuleID is required", { resultIndex, itemIndex });
      }
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
