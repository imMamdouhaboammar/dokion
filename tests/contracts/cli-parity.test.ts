import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  CLI_BUILTIN_CASES,
  CLI_COMMAND_REGISTRY,
  expectedGeminiCommandFiles,
  implementedCliCommands,
  manifestFileForCommand,
  plannedCliCommands,
  specificationFileForCommand
} from "../../src/cli/command-registry.ts";
import { parseCliInvocation } from "../../src/cli/parser.ts";

const root = process.cwd();
const EXPECTED_IMPLEMENTED_IDS = [
  "approve", "audit", "auto-runner", "autopilot", "autoresearch", "compare",
  "configure", "create", "doctor", "findings", "goal", "goals", "hooks",
  "init", "inspect", "loop", "loops", "memory", "plan", "playbooks",
  "plugins", "registry", "reject", "report", "reset", "resume", "run",
  "skills", "skip", "status", "step", "tools", "validate", "verify"
] as const;
const EXPECTED_PLANNED_IDS = ["accept", "hub", "trace", "try"] as const;

interface ManifestCommand {
  command: string;
  usage?: string;
}

interface DokionManifest {
  dokion_cli: {
    commands: ManifestCommand[];
  };
}

interface RegistryCliManifest {
  schema: "dokion.registry-cli.v1";
  commands: ManifestCommand[];
}

async function read(path: string): Promise<string> {
  return Bun.file(join(root, path)).text();
}

const commandCache = new Map<string, ManifestCommand[]>();
async function readCommands(path: string): Promise<ManifestCommand[]> {
  const cached = commandCache.get(path);
  if (cached) return cached;

  const document = JSON.parse(await read(path)) as DokionManifest | RegistryCliManifest;
  const commands = "dokion_cli" in document ? document.dokion_cli.commands : document.commands;
  commandCache.set(path, commands);
  return commands;
}

async function commandEntry(commandId: string, manifestCommand: string): Promise<ManifestCommand | undefined> {
  const source = manifestFileForCommand(commandId);
  const commands = await readCommands(source);
  return commands.find((command) => command.command === manifestCommand);
}

async function runHelp(): Promise<string> {
  const child = Bun.spawn([process.execPath, "run", "src/cli.ts", "--help"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  return stdout;
}

function sorted(values: Iterable<string>): string[] {
  return Array.from(values).sort();
}

describe("canonical CLI command registry", () => {
  test("records exact implemented and planned identities", () => {
    expect(new Set(CLI_COMMAND_REGISTRY.map((command) => command.id)).size).toBe(CLI_COMMAND_REGISTRY.length);
    expect(sorted(implementedCliCommands().map((command) => command.id))).toEqual([...EXPECTED_IMPLEMENTED_IDS]);
    expect(sorted(plannedCliCommands().map((command) => command.id))).toEqual([...EXPECTED_PLANNED_IDS]);
  });

  test("publishes implemented commands only in static manifests", async () => {
    for (const descriptor of implementedCliCommands()) {
      const entry = await commandEntry(descriptor.id, descriptor.manifestCommand);
      const expectedUsage = "manifestUsage" in descriptor ? descriptor.manifestUsage : undefined;
      expect(entry).toBeDefined();
      expect(entry?.usage).toBe(expectedUsage);
    }

    for (const descriptor of plannedCliCommands()) {
      expect(await commandEntry(descriptor.id, descriptor.manifestCommand)).toBeUndefined();
    }
  });

  test("publishes implemented commands only in executable specifications", async () => {
    const baseSpecification = await read("SPEC.md");

    expect(baseSpecification).toContain("| `dokion tools list` · `skills list` · `plugins list` · `loops list` · `goals list` |");
    expect(baseSpecification).toContain("`dokion approve`");

    const specifications = new Map<string, string>();
    for (const descriptor of implementedCliCommands()) {
      const path = specificationFileForCommand(descriptor.id);
      let specification = specifications.get(path);
      if (!specification) {
        specification = await read(path);
        specifications.set(path, specification);
      }
      expect(specification).toContain(descriptor.specMarker);
    }

    for (const descriptor of plannedCliCommands()) {
      expect(baseSpecification).not.toContain(descriptor.specMarker);
    }
  });

  test("keeps implemented and planned runtime cases explicit", async () => {
    const cliSource = await read("src/cli.ts");
    const observedCases = Array.from(cliSource.matchAll(/case "([^"]+)":/g), (match) => match[1]!);
    const expectedCases = ["help", ...implementedCliCommands().map((command) => command.runtimeCase)];

    expect(sorted(new Set(observedCases))).toEqual(sorted(new Set(expectedCases)));
    for (const builtin of CLI_BUILTIN_CASES) {
      expect(parseCliInvocation([builtin])).toEqual({ command: "help", format: "human" });
    }

    for (const command of plannedCliCommands()) {
      expect(observedCases).not.toContain(command.runtimeCase);
    }
  });

  test("keeps help output aligned with implemented commands only", async () => {
    const helpLines = (await runHelp()).split(/\r?\n/);

    for (const command of implementedCliCommands()) {
      expect(command.helpLine).toBeDefined();
      expect(helpLines).toContain(command.helpLine!);
    }

    for (const command of plannedCliCommands()) {
      const exposed = helpLines.some((line) => {
        const normalized = line.trim();
        return normalized === command.runtimeCase || normalized.startsWith(`${command.runtimeCase} `);
      });
      expect(exposed).toBe(false);
    }
  });

  test("keeps Gemini command files aligned with implemented commands only", async () => {
    const commandDirectory = join(root, "commands/dokion");
    const observedFiles = (await readdir(commandDirectory)).filter((path) => path.endsWith(".toml")).sort();

    expect(observedFiles).toEqual([...expectedGeminiCommandFiles()]);

    for (const command of implementedCliCommands()) {
      for (const file of command.geminiFiles) {
        const content = await read(`commands/dokion/${file}`);
        expect(content).toContain(`\`${command.manifestCommand}\``);
      }
    }

    for (const command of plannedCliCommands()) {
      expect(command.geminiFiles).toHaveLength(0);
    }
  });
});
