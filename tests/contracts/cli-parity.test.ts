import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  CLI_BUILTIN_CASES,
  CLI_COMMAND_REGISTRY,
  expectedGeminiCommandFiles,
  implementedCliCommands,
  plannedCliCommands
} from "../../src/cli/command-registry.ts";
import { parseCliInvocation } from "../../src/cli/parser.ts";

const root = process.cwd();

interface ManifestCommand {
  command: string;
  usage?: string;
}

interface DokionManifest {
  dokion_cli: {
    commands: ManifestCommand[];
  };
}

async function read(path: string): Promise<string> {
  return Bun.file(join(root, path)).text();
}

async function readManifest(): Promise<DokionManifest> {
  return JSON.parse(await read("dokion.json")) as DokionManifest;
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
  test("records the complete manifest command inventory in manifest order", async () => {
    const manifest = await readManifest();

    expect(manifest.dokion_cli.commands.map((command) => command.command)).toEqual(
      CLI_COMMAND_REGISTRY.map((command) => command.manifestCommand)
    );
    expect(new Set(CLI_COMMAND_REGISTRY.map((command) => command.id)).size).toBe(CLI_COMMAND_REGISTRY.length);
    expect(implementedCliCommands()).toHaveLength(34);
    expect(plannedCliCommands()).toHaveLength(0);
  });

  test("records source-specific manifest usage without hiding current differences", async () => {
    const manifest = await readManifest();
    const byCommand = new Map(manifest.dokion_cli.commands.map((command) => [command.command, command]));

    for (const descriptor of CLI_COMMAND_REGISTRY) {
      const entry = byCommand.get(descriptor.manifestCommand);
      const expectedUsage = "manifestUsage" in descriptor ? descriptor.manifestUsage : undefined;
      expect(entry).toBeDefined();
      expect(entry?.usage).toBe(expectedUsage);
    }
  });

  test("keeps the specification aware of every declared command", async () => {
    const specification = await read("SPEC.md");

    expect(specification).toContain("| `dokion tools list` · `skills list` · `plugins list` · `loops list` · `goals list` |");

    expect(specification).toContain("`dokion approve`");

    for (const descriptor of CLI_COMMAND_REGISTRY) {
      expect(specification).toContain(descriptor.specMarker);
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

  test("keeps Gemini command files and their invocations registered", async () => {
    const commandDirectory = join(root, "commands/dokion");
    const observedFiles = (await readdir(commandDirectory)).filter((path) => path.endsWith(".toml")).sort();

    expect(observedFiles).toEqual([...expectedGeminiCommandFiles()]);

    for (const command of CLI_COMMAND_REGISTRY) {
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
