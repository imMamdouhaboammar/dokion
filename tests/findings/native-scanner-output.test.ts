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
    stderr: "",
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

  test("rejects unsafe and symlink-escaping output paths before execution", async () => {
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
  });

  test("sanitizes and preserves a file-backed Gitleaks report while deleting raw spool artifacts", async () => {
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

    expect(result.nativeArtifact).toBe(reportPath);
    expect(result.envelope.findings).toHaveLength(1);
    expect(result.envelope.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "generic-api-key",
      location: { file: "src/config.ts", line: 3, end_line: 3 },
    });
    expect(await exists(join(root, reportPath))).toBe(true);
    expect(await exists(join(root, nativeArtifact))).toBe(false);
    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);

    const native = await readFile(join(root, reportPath), "utf8");
    const converted = await readFile(join(root, convertedArtifact), "utf8");
    expect(native).not.toContain(secret);
    expect(converted).not.toContain(secret);
    expect(native).not.toContain("Secret");
    expect(native).not.toContain("Match");
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
