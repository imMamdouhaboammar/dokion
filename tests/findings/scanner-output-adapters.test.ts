import { describe, expect, test } from "bun:test";

import {
  adaptNativeScannerOutput,
  nativeScannerAcceptsExitCode,
  resolveNativeScannerAdapter,
} from "../../src/findings/scanner-output-adapters.ts";

describe("native scanner output adapters", () => {
  test("normalizes OSV Scanner JSON and accepts vulnerability exit code", () => {
    const result = adaptNativeScannerOutput("osv-scanner", {
      results: [{
        source: { path: "bun.lock", type: "lockfile" },
        packages: [{
          package: { name: "example", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [{
            id: "GHSA-test-0001",
            summary: "Prototype pollution",
            database_specific: { severity: "HIGH" },
          }],
        }],
      }],
    });

    expect(resolveNativeScannerAdapter("osv-scanner")).toBe("OSV_SCANNER_JSON");
    expect(nativeScannerAcceptsExitCode("osv-scanner", 1)).toBe(true);
    expect(nativeScannerAcceptsExitCode("osv-scanner", 127)).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "GHSA-test-0001",
      location: { file: "bun.lock" },
    });
    expect(result.findings[0]).not.toHaveProperty("blocks_release");
  });

  test("uses standard OSV severity data when database-specific severity is absent", () => {
    const numeric = adaptNativeScannerOutput("osv-scanner", {
      results: [{
        source: { path: "bun.lock" },
        packages: [{
          package: { name: "example", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [{
            id: "OSV-CRITICAL",
            severity: [{ type: "CVSS_V3", score: "9.8" }],
          }],
        }],
      }],
    });
    const vector = adaptNativeScannerOutput("osv-scanner", {
      results: [{
        source: { path: "bun.lock" },
        packages: [{
          package: { name: "example", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [{
            id: "OSV-VECTOR",
            severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }],
          }],
        }],
      }],
    });

    expect(numeric.findings[0]?.severity).toBe("CRITICAL");
    expect(vector.findings[0]?.severity).toBe("MEDIUM");
  });

  test("normalizes Gitleaks JSON without persisting secret material", () => {
    const payload = [{
      Description: "Generic API Key",
      RuleID: "generic-api-key",
      File: "src/config.ts",
      StartLine: 4,
      EndLine: 4,
      Secret: "super-secret-token",
      Match: "apiKey=super-secret-token",
      Line: "const apiKey = 'super-secret-token'",
      Commit: "abc123",
      Fingerprint: "src/config.ts:generic-api-key:4",
      Tags: ["key", "api"],
    }];

    const result = adaptNativeScannerOutput("gitleaks", payload);
    const serialized = JSON.stringify(result);

    expect(nativeScannerAcceptsExitCode("gitleaks", 1)).toBe(true);
    expect(result.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "generic-api-key",
      location: { file: "src/config.ts", line: 4, end_line: 4 },
    });
    expect(result.findings[0]).not.toHaveProperty("blocks_release");
    expect(serialized).not.toContain("super-secret-token");
  });

  test("normalizes Semgrep JSON with rule and source location", () => {
    const result = adaptNativeScannerOutput("semgrep", {
      results: [{
        check_id: "typescript.lang.security.audit.eval-detected",
        path: "src/run.ts",
        start: { line: 12 },
        end: { line: 12 },
        extra: {
          message: "Avoid eval on untrusted input",
          severity: "ERROR",
          metadata: { cwe: ["CWE-95"], owasp: ["A03:2021"] },
        },
      }],
    });

    expect(result.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "typescript.lang.security.audit.eval-detected",
      location: { file: "src/run.ts", line: 12, end_line: 12 },
    });
    expect(result.findings[0]).not.toHaveProperty("blocks_release");
    expect(result.findings[0]?.tags).toContain("CWE-95");
  });

  test("normalizes Trivy vulnerabilities, misconfigurations, and secrets", () => {
    const result = adaptNativeScannerOutput("trivy", {
      Results: [{
        Target: "package-lock.json",
        Vulnerabilities: [{
          VulnerabilityID: "CVE-2026-0001",
          PkgName: "example",
          InstalledVersion: "1.0.0",
          FixedVersion: "1.0.1",
          Severity: "CRITICAL",
          Title: "Remote code execution",
          Description: "Affected package can execute arbitrary code.",
          PrimaryURL: "https://example.invalid/CVE-2026-0001",
        }],
        Misconfigurations: [{
          ID: "DS001",
          Title: "Debug mode enabled",
          Description: "Production debug mode is enabled.",
          Severity: "MEDIUM",
          Resolution: "Disable debug mode.",
          CauseMetadata: { StartLine: 8, EndLine: 8 },
        }],
        Secrets: [{
          RuleID: "aws-access-key-id",
          Title: "AWS access key",
          Severity: "HIGH",
          StartLine: 2,
          EndLine: 2,
          Match: "AKIA-DO-NOT-PERSIST",
        }],
      }],
    });

    expect(result.findings).toHaveLength(3);
    expect(result.findings.map((finding) => finding.rule_id)).toEqual([
      "CVE-2026-0001",
      "DS001",
      "aws-access-key-id",
    ]);
    expect(result.findings.every((finding) => !("blocks_release" in finding))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("AKIA-DO-NOT-PERSIST");
  });

  test("accepts CycloneDX as a validated artifact with no fabricated findings", () => {
    const result = adaptNativeScannerOutput("trivy", {
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [],
    });

    expect(result).toEqual({ version: 1, findings: [] });
  });

  test("rejects unsupported capabilities and malformed top-level payloads", () => {
    expect(resolveNativeScannerAdapter("unknown-scanner")).toBeNull();
    expect(() => adaptNativeScannerOutput("unknown-scanner", {})).toThrow("No native scanner adapter");
    expect(() => adaptNativeScannerOutput("osv-scanner", { results: "not-an-array" })).toThrow("OSV SCANNER JSON");
  });

  test("rejects malformed nested records instead of silently dropping or fabricating findings", () => {
    expect(() => adaptNativeScannerOutput("osv-scanner", {
      results: [{
        source: { path: "bun.lock" },
        packages: [{
          package: { name: "example", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [{ summary: "missing advisory id" }],
        }],
      }],
    })).toThrow("OSV SCANNER JSON");

    expect(() => adaptNativeScannerOutput("gitleaks", [{}])).toThrow("GITLEAKS JSON");
    expect(() => adaptNativeScannerOutput("semgrep", {
      results: [{
        path: "src/run.ts",
        start: { line: 1 },
        end: { line: 1 },
        extra: { message: "missing rule id", severity: "ERROR" },
      }],
    })).toThrow("SEMGREP JSON");
    expect(() => adaptNativeScannerOutput("trivy", {
      Results: [{
        Target: "package-lock.json",
        Vulnerabilities: [{ Severity: "HIGH", Title: "missing vulnerability id" }],
      }],
    })).toThrow("TRIVY JSON");
  });
});
