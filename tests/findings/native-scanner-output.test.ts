import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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
  test("rejects unsafe and symlink-escaping output paths before execution", async () => {
    const root = await temporaryRoot();
    const outside = await mkdtemp(join(tmpdir(), "dokion-native-outside-"));
    temporaryRoots.push(outside);

    await expect(
      validateNativeScannerCommand(root, "gitleaks", "gitleaks detect --report-path ../outside.json")
    ).rejects.toThrow("repository path policy");

    await rm(join(root, ".dokion/evidence"), { recursive: true, force: true });
    await symlink(outside, join(root, ".dokion/evidence"));
    await expect(
      validateNativeScannerCommand(root, "gitleaks", "gitleaks detect --report-path .dokion/evidence/leaks.json")
    ).rejects.toThrow("repository path policy");
  });

  test("sanitizes a file-backed Gitleaks report and deletes all raw artifacts", async () => {
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

    expect(result.envelope.findings).toHaveLength(1);
    expect(result.envelope.findings[0]).toMatchObject({
      severity: "HIGH",
      rule_id: "generic-api-key",
      location: { file: "src/config.ts", line: 3, end_line: 3 },
    });
    expect(await exists(join(root, reportPath))).toBe(false);
    expect(await exists(join(root, stdoutPath))).toBe(false);
    expect(await exists(join(root, stderrPath))).toBe(false);

    const native = await readFile(join(root, nativeArtifact), "utf8");
    const converted = await readFile(join(root, convertedArtifact), "utf8");
    expect(native).not.toContain(secret);
    expect(converted).not.toContain(secret);
    expect(native).not.toContain("Secret");
    expect(native).not.toContain("Match");
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
  });
});
