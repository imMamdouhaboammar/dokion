import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { builtinCatalog } from "../../src/catalog/builtin-catalog.ts";
import type { ManifestCliCommand } from "../../src/cli/command-registry.ts";

type CommandStatus = "IMPLEMENTED" | "PLANNED";
type ExecutionMode = "READ_ONLY" | "CONFIGURE" | "EXECUTE" | "DECIDE" | "VERIFY_ONLY" | "REPORT_ONLY";
type ApprovalClass = "NONE" | "BEFORE_WRITE" | "FROM_PLAYBOOK" | "ALWAYS" | "DECISION_RECORD";

interface RuntimeCommandDescriptor {
  id: string;
  manifestCommand: string;
  runtimeCase: string;
  status: CommandStatus;
  executionMode: ExecutionMode;
  writeScope: readonly string[];
  approvalClass: ApprovalClass;
}

interface RegistryRuntimeApi {
  renderCliHelp(version: string): string;
  resolveCliCommand(command: string): RuntimeCommandDescriptor | undefined;
  manifestCliCommands(): ManifestCliCommand[];
  geminiCommandsForFile(file: "run.toml" | "status.toml"): readonly RuntimeCommandDescriptor[];
}

const root = process.cwd();
const registryPath = "../../src/cli/command-registry.ts";

async function registryApi(): Promise<RegistryRuntimeApi> {
  return (await import(registryPath)) as unknown as RegistryRuntimeApi;
}

async function runCli(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, "run", "src/cli.ts", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  return { exitCode, stdout, stderr };
}

describe("registry-driven CLI metadata", () => {
  test("renders the complete current help surface", async () => {
    const registry = await registryApi();
    const expected = `Dokion 9.9.9

Usage: dokion <command> [--format human|json]

Observe:
  inspect
  doctor
  status
  findings
  report
  tools list
  skills list
  plugins list
  loops list
  loop <audit|init|cost|sync|context>
  goals list
  goal <audit|init|estimate|status|pause|resume|clear|sync|run>
  hooks <run|status>
  audit
  memory <audit|init|status|patterns>
  compare [<run-a> <run-b>]

Configure:
  init
  plan
  configure
  validate [--catalog-only]
  create [--from-memory <source>] [--transcript <path>] [--topic <topic>]
  reset --state-only
  playbooks <import|validate|sync|list>

Execute:
  run
  step <step-id>
  resume
  verify
  approve <step:id|finding:id> --by <identity> [--notes <text>]
  reject <step:id|finding:id> --by <identity> [--notes <text>]
  skip <step-id> --reason <text>
  autopilot [--dry-run]
  auto-runner [--max-turns 100] [--target 100]
  autoresearch [<goal>] [--auto] [--dry-run]

Dokion never installs, selects, substitutes, reorders, or enables capabilities.`;

    expect(typeof registry.renderCliHelp).toBe("function");
    expect(registry.renderCliHelp("9.9.9")).toBe(expected);
  });

  test("resolves implemented and planned commands", async () => {
    const registry = await registryApi();

    expect(typeof registry.resolveCliCommand).toBe("function");
    expect(registry.resolveCliCommand("status")).toMatchObject({
      id: "status",
      status: "IMPLEMENTED",
      executionMode: "READ_ONLY",
      writeScope: [],
      approvalClass: "NONE"
    });
    expect(registry.resolveCliCommand("configure")).toMatchObject({
      id: "configure",
      status: "IMPLEMENTED",
      executionMode: "CONFIGURE",
      approvalClass: "ALWAYS"
    });
    expect(registry.resolveCliCommand("hub")).toMatchObject({
      id: "hub",
      status: "PLANNED",
      writeScope: []
    });
    expect(registry.resolveCliCommand("not-a-command")).toBeUndefined();
  });

  test("records write and approval boundaries for mutating commands", async () => {
    const registry = await registryApi();

    expect(registry.resolveCliCommand("init")).toMatchObject({
      writeScope: [".dokion/**", "HARDENING.md"],
      approvalClass: "BEFORE_WRITE"
    });
    expect(registry.resolveCliCommand("run")).toMatchObject({
      executionMode: "EXECUTE",
      writeScope: ["PLAYBOOK_DECLARED", ".dokion/**", "HARDENING.md"],
      approvalClass: "FROM_PLAYBOOK"
    });
    expect(registry.resolveCliCommand("approve")).toMatchObject({
      executionMode: "DECIDE",
      writeScope: [".dokion/**", "HARDENING.md"],
      approvalClass: "DECISION_RECORD"
    });
    expect(registry.resolveCliCommand("report")).toMatchObject({
      executionMode: "REPORT_ONLY",
      writeScope: ["HARDENING.md"],
      approvalClass: "NONE"
    });
  });

  test("generates the built-in manifest command catalog", async () => {
    const registry = await registryApi();
    const manifest = JSON.parse(await Bun.file(join(root, "dokion.json")).text()) as {
      dokion_cli: { commands: ManifestCliCommand[] };
    };

    expect(typeof registry.manifestCliCommands).toBe("function");
    expect(registry.manifestCliCommands()).toEqual(manifest.dokion_cli.commands);
    expect(builtinCatalog.dokion_cli.commands).toEqual(registry.manifestCliCommands());
  });

  test("generates ordered Gemini command bindings", async () => {
    const registry = await registryApi();

    expect(typeof registry.geminiCommandsForFile).toBe("function");
    expect(registry.geminiCommandsForFile("run.toml").map((command) => command.manifestCommand)).toEqual([
      "dokion doctor",
      "dokion validate",
      "dokion run"
    ]);
    expect(registry.geminiCommandsForFile("status.toml").map((command) => command.manifestCommand)).toEqual([
      "dokion status",
      "dokion findings",
      "dokion report",
      "dokion loop",
      "dokion goal",
      "dokion memory"
    ]);
  });

  test("uses registry lookup for unknown command diagnostics", async () => {
    const unknown = await runCli("not-a-command");
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stdout).toBe("");
    expect(unknown.stderr).toContain("Unknown command: not-a-command");
  });
});
