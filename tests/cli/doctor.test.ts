import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256 } from "../../src/core/digest.ts";
import { runDoctorAudit } from "../../src/inspect/doctor.ts";

const roots: string[] = [];
const pinned = (character: string): string => `sha256:${character.repeat(64)}`;

async function fixture(): Promise<{ root: string; toolDigest: string }> {
  const root = await mkdtemp(join(tmpdir(), "dokion-doctor-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await mkdir(join(root, "bin"), { recursive: true });
  const toolContent = "#!/usr/bin/env bun\nconsole.log('tool-a 1.0.0');\n";
  await writeFile(join(root, "bin/tool-a"), toolContent);
  await chmod(join(root, "bin/tool-a"), 0o755);
  const toolDigest = sha256(toolContent);

  const playbook = {
    version: "1.0.0",
    project: { name: "doctor-fixture", target: "READY_FOR_STAGING" },
    authority: { capability_selection: "USER_ONLY", execution_order: "USER_ONLY" },
    stages: [{
      id: "security",
      execution: "SEQUENTIAL",
      steps: [{
        id: "scan-a",
        capability: {
          type: "command",
          id: "tool-a",
          version: "1.0.0",
          immutable_reference: toolDigest,
          platforms: { codex: "tool-a" }
        },
        responsibility: "Detect application security findings.",
        mode: "VERIFY_ONLY",
        permissions: { read: ["src/**"], write: [], network: false, shell: [], env: ["SAFE_TOKEN"] }
      }]
    }]
  };
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);

  const lock = {
    schema_version: 1,
    role: {
      purpose: ["metadata_lookup", "security_verification", "digest_verification", "provenance_verification"],
      selection_authority: false,
      substitution_authority: false,
      installation_authority: false
    },
    capabilities: [{
      id: "tool-a",
      type: "command",
      source: { kind: "local", path: "bin/tool-a" },
      platforms: ["codex"],
      versions: [{ version: "1.0.0", digest: toolDigest }],
      required_permissions: { read: ["src/**"], write: [], network: false, shell: [], env: ["SAFE_TOKEN"] },
      installation: { method: "preinstalled" },
      verification: { availability_command: "./bin/tool-a --version", digest_check: true },
      trust_status: "VERIFIED",
      selected_in_playbook_steps: ["scan-a"]
    }]
  };
  await writeFile(join(root, ".dokion/capabilities.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
  return { root, toolDigest };
}

function environment(): Record<string, string | undefined> {
  return {
    DOKION_AGENT: "codex",
    DOKION_GUARANTEE_HOOK_ENFORCEMENT: "1",
    DOKION_GUARANTEE_SUBAGENT_ISOLATION: "1",
    DOKION_GUARANTEE_PARALLEL_WRITES: "1",
    DOKION_GUARANTEE_WORKTREE_ISOLATION: "1",
    SAFE_TOKEN: "secret-must-never-appear",
    UNDECLARED_SECRET: "also-never-appear"
  };
}

async function tree(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(directory: string, prefix = ""): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      result.push(relative);
      if (entry.isDirectory()) await visit(join(directory, entry.name), relative);
    }
  }
  await visit(root);
  return result.sort();
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CAP-008 deterministic doctor audit", () => {
  test("reports capability health deterministically without exposing environment values", async () => {
    const { root } = await fixture();
    const beforeTree = await tree(root);
    const beforePlaybook = await readFile(join(root, ".dokion/playbook.json"), "utf8");
    const beforeLock = await readFile(join(root, ".dokion/capabilities.lock.json"), "utf8");
    const options = {
      environment: environment(),
      which: (command: string) => command === "git" || command === "python3" ? `/usr/bin/${command}` : null
    };

    const first = await runDoctorAudit(root, options);
    const second = await runDoctorAudit(root, options);

    expect(first).toEqual(second);
    expect(first.schema_version).toBe(1);
    expect(first.healthy).toBe(true);
    expect(first.summary.fail).toBe(0);
    expect(first.checks.map((check) => check.id)).toEqual(
      [...first.checks.map((check) => check.id)].sort()
    );
    expect(first.checks).toContainEqual(expect.objectContaining({
      id: "capability:tool-a:digest",
      status: "PASS",
      blocking: false
    }));
    expect(first.checks).toContainEqual(expect.objectContaining({
      id: "environment:SAFE_TOKEN",
      status: "PASS",
      blocking: false
    }));
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("secret-must-never-appear");
    expect(serialized).not.toContain("also-never-appear");
    expect(serialized).not.toContain(root);
    expect(await tree(root)).toEqual(beforeTree);
    expect(await readFile(join(root, ".dokion/playbook.json"), "utf8")).toBe(beforePlaybook);
    expect(await readFile(join(root, ".dokion/capabilities.lock.json"), "utf8")).toBe(beforeLock);
  });

  test("marks digest provenance prerequisite and platform conflicts as blocking", async () => {
    const { root } = await fixture();
    const playbookPath = join(root, ".dokion/playbook.json");
    const lockPath = join(root, ".dokion/capabilities.lock.json");
    const playbook = JSON.parse(await readFile(playbookPath, "utf8")) as any;
    playbook.stages[0].steps[0].capability.platforms = { claude_code: "tool-a" };
    await writeFile(playbookPath, `${JSON.stringify(playbook, null, 2)}\n`);

    const lock = JSON.parse(await readFile(lockPath, "utf8")) as any;
    lock.capabilities[0].platforms = ["claude_code"];
    lock.capabilities[0].versions[0].digest = pinned("b");
    lock.capabilities[0].installation = {
      method: "package_manager",
      command: "NPM_TOKEN=provenance-secret npm install tool-a"
    };
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const report = await runDoctorAudit(root, {
      environment: {
        ...environment(),
        SAFE_TOKEN: undefined
      },
      which: (command) => command === "git" || command === "python3" ? `/usr/bin/${command}` : null
    });

    expect(report.healthy).toBe(false);
    const failures = report.checks.filter((check) => check.status === "FAIL");
    expect(failures.map((check) => check.id)).toEqual(expect.arrayContaining([
      "capability:tool-a:digest",
      "capability:tool-a:provenance",
      "conflict:PLATFORM_INCOMPATIBLE:scan-a",
      "environment:SAFE_TOKEN"
    ]));
    expect(failures.every((check) => check.blocking)).toBe(true);
    expect(JSON.stringify(report)).not.toContain("provenance-secret");

    const cliEnvironment = { ...process.env, ...environment() };
    delete cliEnvironment.SAFE_TOKEN;
    const child = Bun.spawn([
      process.execPath,
      "run",
      join(process.cwd(), "src/cli.ts"),
      "doctor",
      "--format",
      "json"
    ], {
      cwd: root,
      env: cliEnvironment,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore"
    });
    const [exitCode, stdout] = await Promise.all([
      child.exited,
      child.stdout ? new Response(child.stdout).text() : ""
    ]);
    expect(exitCode).toBe(1);
    expect(JSON.parse(stdout)).toMatchObject({ healthy: false });
  });

  test("fails closed instead of crashing on a malformed capability lock", async () => {
    const { root } = await fixture();
    const lockPath = join(root, ".dokion/capabilities.lock.json");
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as any;
    lock.capabilities[0].versions = "not-an-array";
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const report = await runDoctorAudit(root, {
      environment: environment(),
      which: (command) => command === "git" || command === "python3" ? `/usr/bin/${command}` : null
    });

    expect(report.healthy).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: "repository:contracts",
      status: "FAIL",
      blocking: true
    }));
  });

  test("reports an unverifiable source artifact as a blocking digest failure", async () => {
    const { root } = await fixture();
    const lockPath = join(root, ".dokion/capabilities.lock.json");
    const lock = JSON.parse(await readFile(lockPath, "utf8")) as any;
    lock.capabilities[0].source.path = "bin";
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

    const report = await runDoctorAudit(root, {
      environment: environment(),
      which: (command) => command === "git" || command === "python3" ? `/usr/bin/${command}` : null
    });

    expect(report.healthy).toBe(false);
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: "capability:tool-a:digest",
      status: "FAIL",
      blocking: true
    }));
  });

  test("the doctor CLI uses the audit and remains read-only", async () => {
    const { root } = await fixture();
    const beforeTree = await tree(root);
    const child = Bun.spawn([
      process.execPath,
      "run",
      join(process.cwd(), "src/cli.ts"),
      "doctor",
      "--format",
      "json"
    ], {
      cwd: root,
      env: { ...process.env, ...environment() },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore"
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      child.stdout ? new Response(child.stdout).text() : "",
      child.stderr ? new Response(child.stderr).text() : ""
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    const report = JSON.parse(stdout) as { schema_version: number; healthy: boolean; checks: unknown[] };
    expect(report.schema_version).toBe(1);
    expect(report.healthy).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
    expect(await tree(root)).toEqual(beforeTree);
    expect(await Bun.file(join(root, ".dokion/state.json")).exists()).toBe(false);
    expect(await Bun.file(join(root, "HARDENING.md")).exists()).toBe(false);
  });
});
