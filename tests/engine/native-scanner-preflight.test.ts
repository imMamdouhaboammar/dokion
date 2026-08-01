import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAnalyzeCapability } from "../../src/engine/capability-runner.ts";
import { listFindings } from "../../src/findings/finding-store.ts";
import type { LoadedPlaybook, PlaybookStage, PlaybookStep } from "../../src/playbook/types.ts";
import type { DokionState } from "../../src/state/types.ts";

const roots: string[] = [];

function executionInput(root: string, step: PlaybookStep) {
  return {
    root,
    loaded: { data: { defaults: {} } } as LoadedPlaybook,
    state: { run: { id: "run-preflight" } } as DokionState,
    stage: { id: "security", execution: "SEQUENTIAL", steps: [step] } satisfies PlaybookStage,
    step,
  };
}

async function fixtureRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native scanner engine preflight", () => {
  test("rejects an unsafe declared report path before the scanner command can run", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-scanner-preflight-"));
    roots.push(root);
    const marker = join(root, "executed.marker");
    const command = [
      "bun -e",
      JSON.stringify("require('node:fs').writeFileSync('executed.marker','yes')"),
      "-- --report-format json --report-path ../outside.json",
    ].join(" ");
    const step = {
      id: "secret-scan",
      capability: {
        type: "tool",
        id: "gitleaks",
        immutable_reference: `sha256:${"a".repeat(64)}`,
      },
      responsibility: "Scan for secrets",
      mode: "ANALYZE",
      permissions: {
        read: ["**/*"],
        write: [".dokion/**"],
        network: false,
        shell: [command],
      },
      verification: [],
    } satisfies PlaybookStep;

    await expect(runAnalyzeCapability(executionInput(root, step))).rejects.toThrow("repository path policy");
    expect(await Bun.file(marker).exists()).toBe(false);
  });

  test("runs an allowed native scanner command with the repository as its working directory", async () => {
    const root = await fixtureRoot("dokion-scanner-positive-control-");
    const reportPath = ".dokion/evidence/gitleaks.json";
    const script = [
      "const fs=require('node:fs');",
      "fs.writeFileSync('executed.marker','yes');",
      `fs.writeFileSync(${JSON.stringify(reportPath)},JSON.stringify([{Description:'Fixture secret',RuleID:'fixture-secret',File:'src/config.ts',StartLine:1,EndLine:1}]));`,
      "process.exit(1);",
    ].join("");
    const command = `bun -e ${JSON.stringify(script)} -- --report-format json --report-path ${reportPath}`;
    const step = {
      id: "secret-scan",
      capability: {
        type: "tool",
        id: "gitleaks",
        immutable_reference: `sha256:${"c".repeat(64)}`,
      },
      responsibility: "Scan for secrets",
      mode: "ANALYZE",
      permissions: {
        read: ["**/*"],
        write: [".dokion/**"],
        network: false,
        shell: [command],
      },
      verification: [],
    } satisfies PlaybookStep;

    const result = await runAnalyzeCapability(executionInput(root, step));
    expect(result.status).toBe("SUCCEEDED");
    expect(await Bun.file(join(root, "executed.marker")).text()).toBe("yes");
    expect(await Bun.file(join(root, ".dokion/evidence/run-preflight/steps/security/secret-scan/native-output.json")).exists()).toBe(true);
  });

  test("does not let a registered native scanner bypass its adapter through DOKION_OUTPUT", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-scanner-protocol-bypass-"));
    roots.push(root);
    const nativePayload = {
      results: [{
        source: { path: "bun.lock" },
        packages: [{
          package: { name: "real-package", version: "1.0.0", ecosystem: "npm" },
          vulnerabilities: [{
            id: "GHSA-real-0001",
            summary: "Real native finding",
            database_specific: { severity: "HIGH" },
          }],
        }],
      }],
    };
    const script = [
      "const fs=require('node:fs');",
      "fs.writeFileSync(process.env.DOKION_OUTPUT,JSON.stringify({version:1,findings:[{severity:'INFO',title:'fabricated protocol finding'}]}));",
      `console.log(${JSON.stringify(JSON.stringify(nativePayload))});`,
    ].join("");
    const command = `bun -e ${JSON.stringify(script)} -- --format json`;
    const step = {
      id: "dependency-scan",
      capability: {
        type: "tool",
        id: "osv-scanner",
        immutable_reference: `sha256:${"b".repeat(64)}`,
      },
      responsibility: "Scan dependencies",
      mode: "ANALYZE",
      permissions: {
        read: ["**/*"],
        write: [".dokion/**"],
        network: false,
        shell: [command],
      },
      verification: [],
    } satisfies PlaybookStep;

    const result = await runAnalyzeCapability(executionInput(root, step));
    expect(result.status).toBe("FAILED");
    if (result.status === "FAILED") {
      expect(result.reason).toContain("reserved DOKION_OUTPUT");
      expect(result.evidence.some((path) => path.endsWith("native-failure.json"))).toBe(true);
    }
    expect(await listFindings(root)).toHaveLength(0);
    expect(await Bun.file(join(
      root,
      ".dokion/evidence/run-preflight/steps/security/dependency-scan/raw-findings.json"
    )).exists()).toBe(false);
  });
});
