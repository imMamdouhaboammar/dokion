import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CommandResult } from "../../src/engine/command-runner.ts";
import {
  materializeNativeScannerOutput,
  validateNativeScannerCommand,
} from "../../src/findings/native-scanner-output.ts";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-native-scanner-"));
  temporaryRoots.push(root);
  await mkdir(join(root, ".dokion/evidence/spool"), { recursive: true });
  return root;
}

function commandResult(input: {
  command: string;
  exitCode: number;
  stdoutArtifact: string;
  stderrArtifact: string;
  truncated?: boolean;
  stderr?: string;
}): CommandResult {
  const now = new Date().toISOString();
  const spool = (artifactPath: string, truncated = false) => ({
    artifactPath,
    mediaType: "application/octet-stream",
    bytesObserved: 1,
    bytesStored: 1,
    truncated,
    artifactDigest: "sha256:test",
    observedDigest: "sha256:test",
    summary: "",
    summaryEncoding: "utf8" as const,
  });
  return {
    command: input.command,
    commandIdentity: "sha256:test",
    commandKind: "SHELL",
    risk: "HIGHER",
    shellParsing: true,
    degradations: [],
    stdout: "",
    stderr: input.stderr ?? "",
    stdoutArtifact: spool(input.stdoutArtifact, input.truncated ?? false),
    stderrArtifact: spool(input.stderrArtifact),
    exitCode: input.exitCode,
    startedAt: now,
    endedAt: now,
    durationMs: 1,
    environment: {
      inheritedNames: [],
      runtimeNames: [],
      missingDeclaredNames: [],
      deniedNames: [],
      redactedNames: [],
    },
  };
}

async function exists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native scanner output materialization", () => {
  test("requires an explicit supported JSON output format for each registered scanner", async () => {
    const root = await temporaryRoot();
    const commands = [
      ["osv-scanner", "osv-scanner --recursive ."],
      ["gitleaks", "gitleaks detect --report-path .dokion/evidence/gitleaks.json"],
      ["semgrep", "semgrep --config auto --output .dokion/evidence/semgrep.json"],
      ["trivy", "trivy fs --output .dokion/evidence/trivy.json ."],
    ] as const;

    for (const [capabilityId, command] of commands) {
      await expect(validateNativeScannerCommand(root, capabilityId, command)).rejects.toThrow("JSON output format");
    }
  });

  test("does not infer flags from quoted script text or accept shell-expanded output paths", async () => {
    const root = await temporaryRoot();

    await expect(validateNativeScannerCommand(
      root,
      "osv-scanner",
      `bun -e "console.log('--format json')"`
    )).rejects.toThrow("JSON output format");

    await expect(validateNativeScannerCommand(
      root,
      "gitleaks",
      `gitleaks detect --report-format json --report-path "$REPORT"`
    )).rejects.toThrow("shell expansion");
  });

  test("rejects unsafe, symlink-escaping, and canonically reserved output paths before execution", async () => {
    const root = await temporaryRoot();
    const outside = await mkdtemp(join(tmpdir(), "dokion-native-outside-"));
    temporaryRoots.push(outside);

    await expect(
      validateNativeScannerCommand(root, "gitleaks", "gitleaks detect --report-format json --report-path ../outside.json")
    ).rejects.toThrow("repository path policy");

    await rm(join(root, ".dokion/evidence"), { recursive: true, force: true });
    await symlink(outside, join(root, ".dokion/evidence"));
    await expect(
      validateNativeScannerCommand(root, "gitleaks", "gitleaks detect --report-format json --report-path .dokion/evidence/leaks.json")
    ).rejects.toThrow("repository path policy");

    await rm(join(root, ".dokion/evidence"), { force: true });
    const reservedDirectory = join(root, ".dokion/evidence/run/steps/osv");
    await mkdir(reservedDirectory, { recursive: true });
    await symlink(reservedDirectory, join(root, ".dokion/evidence/alias"));
    await expect(validateNativeScannerCommand(
      root,
      "osv-scanner",
      "osv-scanner --format json --output .dokion/evidence/alias/raw-findings.json",
      [".dokion/evidence/run/steps/osv/raw-findings.json"]
    )).rejects.toThrow("collides with an internal Dokion artifact");
  });

  test("moves a sanitized file-backed Gitleaks report into immutable run-scoped evidence", async () => {
    const root = await temporaryRoot();
    const reportPath = ".dokion/evidence/gitleaks.json";
    const stdoutPath = ".dokion/evidence/spool/stdout.bin";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    const nativeArtifact = ".dokion/evidence/run/steps/gitleaks/native-output.json";
    const convertedArtifact = ".dokion/evidence/run/steps/gitleaks/raw-findings.json";
    const secret = "super-secret-value";

    await writeFile(join(root, reportPath), JSON.stringify([{
      Description: "Generic API key",
      RuleID: "generic-api-key",
      File: "src/config.ts",
      StartLine: 3,
      EndLine: 3,
      Secret: secret,
      Match: `apiKey=${secret}`,
      Line: `const apiKey = '${secret}'`,
      Fingerprint: "src/config.ts:generic-api-key:3",
    }]));
    await writeFile(join(root, stdoutPath), "scanner summary");
    await writeFile(join(root, stderrPath), "scanner diagnostic");

    const result = await materializeNativeScannerOutput({
      root,
      capabilityId: "gitleaks",
      command: `gitleaks detect --report-format json --report-path ${reportPath}`,
      result: commandResult({
        command: "gitleaks detect",
        exitCode: 1,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact,
      convertedArtifact,
    });

    expect(result.nativeArtifact).toBe(nativeArtifact);
    expect(result.envelope.findings).toHaveLength(1);
    expect(result.envelope.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "generic-api-key",
      location: { file: "src/config.ts", line: 3, end_line: 3 },
    });
    expect(await exists(join(root, reportPath))).toBe(false);
    expect(await exists(join(root, nativeArtifact))).toBe(true);
    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);

    const native = await readFile(join(root, nativeArtifact), "utf8");
    const converted = await readFile(join(root, convertedArtifact), "utf8");
    expect(native).not.toContain(secret);
    expect(converted).not.toContain(secret);
    expect(native).not.toContain("Secret");
    expect(native).not.toContain("Match");
  });

  test("removes Semgrep source excerpts and metavariables before persisting evidence", async () => {
    const root = await temporaryRoot();
    const reportPath = ".dokion/evidence/semgrep.json";
    const stdoutPath = ".dokion/evidence/spool/stdout.bin";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    const nativeArtifact = ".dokion/evidence/run/steps/semgrep/native-output.json";
    const convertedArtifact = ".dokion/evidence/run/steps/semgrep/raw-findings.json";
    const secret = "source-secret-value";

    await writeFile(join(root, reportPath), JSON.stringify({
      results: [{
        check_id: "hardcoded-secret",
        path: "src/config.ts",
        start: { line: 1 },
        end: { line: 1 },
        extra: {
          message: "Hardcoded secret",
          severity: "ERROR",
          lines: `const token = '${secret}'`,
          metavars: { "$TOKEN": { abstract_content: secret } },
          dataflow_trace: { taint_source: [{ content: secret }] },
        },
      }],
    }));
    await writeFile(join(root, stdoutPath), "");
    await writeFile(join(root, stderrPath), "");

    const result = await materializeNativeScannerOutput({
      root,
      capabilityId: "semgrep",
      command: `semgrep --config auto --json --output ${reportPath}`,
      result: commandResult({
        command: "semgrep",
        exitCode: 0,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact,
      convertedArtifact,
    });

    expect(result.envelope.findings).toHaveLength(1);
    const native = await readFile(join(root, nativeArtifact), "utf8");
    const converted = await readFile(join(root, convertedArtifact), "utf8");
    expect(native).not.toContain(secret);
    expect(converted).not.toContain(secret);
    expect(native).not.toContain("metavars");
    expect(native).not.toContain("dataflow_trace");
  });

  test("rejects an oversized file-backed report before loading it into memory", async () => {
    const root = await temporaryRoot();
    const reportPath = ".dokion/evidence/gitleaks-large.json";
    const stdoutPath = ".dokion/evidence/spool/stdout.bin";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    await writeFile(join(root, reportPath), "");
    await truncate(join(root, reportPath), 64 * 1024 * 1024 + 1);
    await writeFile(join(root, stdoutPath), "");
    await writeFile(join(root, stderrPath), "");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "gitleaks",
      command: `gitleaks detect --report-format json --report-path ${reportPath}`,
      result: commandResult({
        command: "gitleaks detect",
        exitCode: 0,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact: ".dokion/evidence/run/steps/gitleaks/native-output.json",
      convertedArtifact: ".dokion/evidence/run/steps/gitleaks/raw-findings.json",
    })).rejects.toThrow("exceeds the maximum evidence size");

    expect(await exists(join(root, reportPath))).toBe(false);
  });

  test("rejects a symbolic link when stdout is the native scanner artifact", async () => {
    const root = await temporaryRoot();
    const outside = await mkdtemp(join(tmpdir(), "dokion-native-link-target-"));
    temporaryRoots.push(outside);
    const target = join(outside, "report.json");
    const stdoutPath = ".dokion/evidence/spool/stdout.json";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    await writeFile(target, JSON.stringify({ results: [] }));
    await symlink(target, join(root, stdoutPath));
    await writeFile(join(root, stderrPath), "");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "osv-scanner",
      command: "osv-scanner --format json --recursive .",
      result: commandResult({
        command: "osv-scanner --format json --recursive .",
        exitCode: 0,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact: ".dokion/evidence/run/steps/osv/native-output.json",
      convertedArtifact: ".dokion/evidence/run/steps/osv/raw-findings.json",
    })).rejects.toThrow("symbolic link");

    expect(await exists(target)).toBe(true);
  });

  test("rejects a Trivy payload whose actual format contradicts the declared format", async () => {
    const root = await temporaryRoot();
    const reportPath = ".dokion/evidence/trivy.json";
    const stdoutPath = ".dokion/evidence/spool/stdout.bin";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    await writeFile(join(root, reportPath), JSON.stringify({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [],
    }));
    await writeFile(join(root, stdoutPath), "");
    await writeFile(join(root, stderrPath), "");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "trivy",
      command: `trivy fs --format json --output ${reportPath} .`,
      result: commandResult({
        command: "trivy fs",
        exitCode: 0,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact: ".dokion/evidence/run/steps/trivy/native-output.json",
      convertedArtifact: ".dokion/evidence/run/steps/trivy/raw-findings.json",
    })).rejects.toThrow("does not match the declared format");
  });

  test("records bounded diagnostics when native output is malformed", async () => {
    const root = await temporaryRoot();
    const stdoutPath = ".dokion/evidence/spool/stdout.json";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    const nativeArtifact = ".dokion/evidence/run/steps/osv/native-output.json";
    const failureArtifact = ".dokion/evidence/run/steps/osv/native-failure.json";
    await writeFile(join(root, stdoutPath), JSON.stringify({ results: "invalid" }));
    await writeFile(join(root, stderrPath), "scanner diagnostic");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "osv-scanner",
      command: "osv-scanner --format json --recursive .",
      result: commandResult({
        command: "osv-scanner --format json --recursive .",
        exitCode: 1,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
        stderr: "scanner diagnostic",
      }),
      nativeArtifact,
      convertedArtifact: ".dokion/evidence/run/steps/osv/raw-findings.json",
    })).rejects.toThrow("OSV SCANNER JSON");

    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);
    expect(await exists(join(root, failureArtifact))).toBe(true);
    const failure = await readFile(join(root, failureArtifact), "utf8");
    expect(failure).toContain("scanner diagnostic");
    expect(failure).toContain("sha256:");
    expect(failure).not.toContain("results\":\"invalid");
  });

  test("rejects a findings exit code when the adapted payload contains no findings", async () => {
    const root = await temporaryRoot();
    const stdoutPath = ".dokion/evidence/spool/stdout.json";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    await writeFile(join(root, stdoutPath), JSON.stringify({ results: [] }));
    await writeFile(join(root, stderrPath), "");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "osv-scanner",
      command: "osv-scanner --format json --recursive .",
      result: commandResult({
        command: "osv-scanner --format json --recursive .",
        exitCode: 1,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
      }),
      nativeArtifact: ".dokion/evidence/run/steps/osv/native-output.json",
      convertedArtifact: ".dokion/evidence/run/steps/osv/raw-findings.json",
    })).rejects.toThrow("adapter produced no findings");

    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);
  });

  test("rejects truncated stdout instead of parsing a partial scanner report", async () => {
    const root = await temporaryRoot();
    const stdoutPath = ".dokion/evidence/spool/stdout.json";
    const stderrPath = ".dokion/evidence/spool/stderr.bin";
    await writeFile(join(root, stdoutPath), JSON.stringify({ results: [] }));
    await writeFile(join(root, stderrPath), "");

    await expect(materializeNativeScannerOutput({
      root,
      capabilityId: "osv-scanner",
      command: "osv-scanner --format json --recursive .",
      result: commandResult({
        command: "osv-scanner --format json --recursive .",
        exitCode: 0,
        stdoutArtifact: stdoutPath,
        stderrArtifact: stderrPath,
        truncated: true,
      }),
      nativeArtifact: ".dokion/evidence/run/steps/osv/native-output.json",
      convertedArtifact: ".dokion/evidence/run/steps/osv/raw-findings.json",
    })).rejects.toThrow("exceeded the evidence bound");

    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);
  });
});
