import {
  CLI_COMMAND_REGISTRY as LEGACY_CLI_COMMAND_REGISTRY,
  type CliCommandDescriptor,
  type GeminiCommandFile,
  type ManifestCliCommand
} from "./command-registry-base.ts";

export * from "./command-registry-base.ts";

const HUB_PURPOSE =
  "Federated Playbook Registry is unavailable while the replacement protocol is implemented under #47.";

export const CLI_COMMAND_REGISTRY: readonly CliCommandDescriptor[] = LEGACY_CLI_COMMAND_REGISTRY.map((command) => {
  if (command.id !== "hub") return command;

  return {
    ...command,
    manifestUsage: "dokion hub",
    purpose: HUB_PURPOSE,
    helpLine: "  hub",
    status: "PLANNED",
    writeScope: [],
    geminiFiles: []
  } satisfies CliCommandDescriptor;
});

export function implementedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "IMPLEMENTED");
}

export function plannedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "PLANNED");
}

export function resolveCliCommand(command: string): CliCommandDescriptor | undefined {
  return CLI_COMMAND_REGISTRY.find((descriptor) => descriptor.runtimeCase === command);
}

export function renderCliHelp(version: string): string {
  const groups = ["Observe", "Configure", "Execute"] as const;
  const lines = [`Dokion ${version}`, "", "Usage: dokion <command> [--format human|json]", ""];

  for (const group of groups) {
    lines.push(`${group}:`);
    for (const command of implementedCliCommands()
      .filter((descriptor) => descriptor.helpGroup === group)
      .sort((left, right) => left.helpOrder - right.helpOrder)) {
      lines.push(command.helpLine);
    }
    lines.push("");
  }

  lines.push("Dokion never installs, selects, substitutes, reorders, or enables capabilities.");
  return lines.join("\n");
}

export function manifestCliCommands(): ManifestCliCommand[] {
  return CLI_COMMAND_REGISTRY.map((command) => ({
    command: command.manifestCommand,
    ...("manifestUsage" in command && command.manifestUsage !== undefined ? { usage: command.manifestUsage } : {}),
    purpose: command.purpose,
    ...("manifestMode" in command && command.manifestMode !== undefined ? { mode: command.manifestMode } : {}),
    ...("manifestWrites" in command && command.manifestWrites !== undefined ? { writes: [...command.manifestWrites] } : {}),
    ...("manifestApproval" in command && command.manifestApproval !== undefined
      ? { approval: command.manifestApproval }
      : {})
  }));
}

export function expectedGeminiCommandFiles(): GeminiCommandFile[] {
  return Array.from(new Set(CLI_COMMAND_REGISTRY.flatMap((command) => command.geminiFiles))).sort();
}

export function geminiCommandsForFile(file: GeminiCommandFile): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.geminiFiles.includes(file)).sort(
    (left, right) => (left.geminiOrder ?? Number.MAX_SAFE_INTEGER) - (right.geminiOrder ?? Number.MAX_SAFE_INTEGER)
  );
}
