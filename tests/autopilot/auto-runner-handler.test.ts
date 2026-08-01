import { afterEach, describe, expect, test } from "bun:test";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleAutoRunnerCommand } from "../../src/cli/handlers/auto-runner.ts";
import { listFindings } from "../../src/findings/finding-store.ts";
import { StateStore } from "../../src/state/state-store.ts";
import { initializeGitFixture } from "../helpers/git-fixture.ts";

const temporaryRoots: string[] = [];
const originalExitCode = process.exitCode;

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-auto-runner-"));
  temporaryRoots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await initializeGitFixture(root);
  return root;
}

async function writeAnalyzePlaybook(root: string, verificationCommand = "true"): Promise<void> {
  const raw = await readFile(join(process.cwd(), "playbooks/example.playbook.json"), "utf8");
  const playbook = JSON.parse(raw.replaceAll("sha256:PLACEHOLDER", `sha256:${"a".repeat(64)}`));
  const template = playbook.stages[0].steps[0];
  const capabilityCommand = [
    "bun -e \"",
    "const fs=require('node:fs');",
    "fs.writeFileSync('.dokion/capability-ran','yes');",
    "fs.writeFileSync(process.env.DOKION_OUTPUT,JSON.stringify({version:1,findings:[{severity:'LOW',title:'fixture finding'}]}));",
    "\"",
  ].join("");

  playbook.project.name = "auto-runner-real-execution";
  playbook.project.target = "READY_FOR_STAGING";
  playbook.stages = [
    {
      id: "analysis",
      name: "Analysis",
      execution: "SEQUENTIAL",
      steps: [
        {
          ...structuredClone(template),
          id: "analyze-project",
          responsibility: "Run the declared analysis capability against the repository",
          mode: "ANALYZE",
          approval: "NEVER",
          capability: {
            ...structuredClone(template.capability),
            id: "fixture-analyzer",
            immutable_reference: `sha256:${"b".repeat(64)}`,
          },
          permissions: {
            read: ["**/*"],
            write: [".dokion/**", "HARDENING.md"],
            network: false,
            shell: [capabilityCommand, verificationCommand],
          },
          verification: [verificationCommand],
          success_conditions: ["capability_output_recorded", "verification_passed"],
          failure_policy: "STOP_PIPELINE",
        },
      ],
    },
  ];
  playbook.release_gates = [];

  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
}

afterEach(async () => {
  process.exitCode = originalExitCode;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("auto-runner CLI production execution", () => {
  test("invokes the declared capability, runs verification, and supports --format json", async () => {
    const root = await createFixtureRoot();
    await writeAnalyzePlaybook(root);

    await handleAutoRunnerCommand(root, {
      options: new Map([["--format", "json"]]),
      flags: new Set(),
      format: "json",
    });

    expect(await readFile(join(root, ".dokion/capability-ran"), "utf8")).toBe("yes");

    const state = await new StateStore(root).load();
    expect(state.run.status).toBe("COMPLETED");
    expect(state.stages[0]?.id).toBe("analysis");
    expect(state.stages[0]?.steps[0]?.status).toBe("SUCCEEDED");
    expect(state.stages[0]?.steps[0]?.evidence?.some((path) => path.endsWith("raw-findings.json"))).toBe(true);
    expect(state.stages[0]?.steps[0]?.verification_results?.some((result) => result.command === "true" && result.exit_code === 0)).toBe(true);

    const findings = await listFindings(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("fixture finding");

    await access(join(root, ".dokion/evidence", state.run.id, "steps", "analysis", "analyze-project", "raw-findings.json"));
  });

  test("fails an analysis step when its declared verification fails", async () => {
    const root = await createFixtureRoot();
    await writeAnalyzePlaybook(root, "false");

    await handleAutoRunnerCommand(root, {
      options: new Map([["--format", "json"]]),
      flags: new Set(),
      format: "json",
    });

    expect(await readFile(join(root, ".dokion/capability-ran"), "utf8")).toBe("yes");

    const state = await new StateStore(root).load();
    const step = state.stages[0]?.steps[0];
    expect(state.run.status).toBe("FAILED");
    expect(step?.status).toBe("FAILED");
    expect(step?.verification_results?.some((result) => result.command === "false" && result.exit_code !== 0)).toBe(true);
    expect(process.exitCode).toBe(1);
  });
});
