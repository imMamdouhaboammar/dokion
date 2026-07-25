export type CliCommandStatus = "IMPLEMENTED" | "PLANNED";

export type GeminiCommandFile = "run.toml" | "status.toml";

export interface CliCommandDescriptor {
  id: string;
  manifestCommand: `dokion ${string}`;
  manifestUsage?: string;
  specMarker: string;
  runtimeCase: string;
  helpLine?: string;
  status: CliCommandStatus;
  geminiFiles: readonly GeminiCommandFile[];
}

export const CLI_BUILTIN_CASES = ["help", "--help", "-h"] as const;

export const CLI_COMMAND_REGISTRY = [
  {
    id: "init",
    manifestCommand: "dokion init",
    specMarker: "`dokion init`",
    runtimeCase: "init",
    helpLine: "  init",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "inspect",
    manifestCommand: "dokion inspect",
    specMarker: "`dokion inspect`",
    runtimeCase: "inspect",
    helpLine: "  inspect",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "configure",
    manifestCommand: "dokion configure",
    specMarker: "`dokion configure`",
    runtimeCase: "configure",
    status: "PLANNED",
    geminiFiles: []
  },
  {
    id: "validate",
    manifestCommand: "dokion validate",
    specMarker: "`dokion validate`",
    runtimeCase: "validate",
    helpLine: "  validate [--catalog-only]",
    status: "IMPLEMENTED",
    geminiFiles: ["run.toml"]
  },
  {
    id: "doctor",
    manifestCommand: "dokion doctor",
    specMarker: "`dokion doctor`",
    runtimeCase: "doctor",
    helpLine: "  doctor",
    status: "IMPLEMENTED",
    geminiFiles: ["run.toml"]
  },
  {
    id: "plan",
    manifestCommand: "dokion plan",
    specMarker: "`dokion plan`",
    runtimeCase: "plan",
    status: "PLANNED",
    geminiFiles: []
  },
  {
    id: "run",
    manifestCommand: "dokion run",
    manifestUsage: "dokion run [loop-id|all]",
    specMarker: "`dokion run`",
    runtimeCase: "run",
    helpLine: "  run",
    status: "IMPLEMENTED",
    geminiFiles: ["run.toml"]
  },
  {
    id: "step",
    manifestCommand: "dokion step",
    manifestUsage: "dokion step <step-id>",
    specMarker: "`dokion step`",
    runtimeCase: "step",
    status: "PLANNED",
    geminiFiles: []
  },
  {
    id: "resume",
    manifestCommand: "dokion resume",
    specMarker: "`dokion resume`",
    runtimeCase: "resume",
    helpLine: "  resume",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "status",
    manifestCommand: "dokion status",
    specMarker: "`dokion status`",
    runtimeCase: "status",
    helpLine: "  status",
    status: "IMPLEMENTED",
    geminiFiles: ["status.toml"]
  },
  {
    id: "approve",
    manifestCommand: "dokion approve",
    manifestUsage: "dokion approve <approval-id>",
    specMarker: "`dokion approve`",
    runtimeCase: "approve",
    helpLine: "  approve <step:id|finding:id> --by <identity> [--notes <text>]",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "reject",
    manifestCommand: "dokion reject",
    manifestUsage: "dokion reject <approval-id> --reason <text>",
    specMarker: "`reject`",
    runtimeCase: "reject",
    helpLine: "  reject <step:id|finding:id> --by <identity> [--notes <text>]",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "skip",
    manifestCommand: "dokion skip",
    manifestUsage: "dokion skip <step-id> --reason <text>",
    specMarker: "`skip`",
    runtimeCase: "skip",
    status: "PLANNED",
    geminiFiles: []
  },
  {
    id: "findings",
    manifestCommand: "dokion findings",
    manifestUsage: "dokion findings [--severity HIGH] [--status OPEN]",
    specMarker: "`dokion findings`",
    runtimeCase: "findings",
    helpLine: "  findings",
    status: "IMPLEMENTED",
    geminiFiles: ["status.toml"]
  },
  {
    id: "verify",
    manifestCommand: "dokion verify",
    specMarker: "`dokion verify`",
    runtimeCase: "verify",
    helpLine: "  verify",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "report",
    manifestCommand: "dokion report",
    manifestUsage: "dokion report [--format markdown|json]",
    specMarker: "`dokion report`",
    runtimeCase: "report",
    helpLine: "  report",
    status: "IMPLEMENTED",
    geminiFiles: ["status.toml"]
  },
  {
    id: "tools-list",
    manifestCommand: "dokion tools list",
    specMarker: "`dokion tools list`",
    runtimeCase: "tools",
    helpLine: "  tools list",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "skills-list",
    manifestCommand: "dokion skills list",
    specMarker: "`skills list`",
    runtimeCase: "skills",
    helpLine: "  skills list",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "plugins-list",
    manifestCommand: "dokion plugins list",
    specMarker: "`plugins list`",
    runtimeCase: "plugins",
    helpLine: "  plugins list",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "loops-list",
    manifestCommand: "dokion loops list",
    specMarker: "`loops list`",
    runtimeCase: "loops",
    helpLine: "  loops list",
    status: "IMPLEMENTED",
    geminiFiles: []
  },
  {
    id: "reset-state",
    manifestCommand: "dokion reset --state-only",
    specMarker: "`dokion reset --state-only`",
    runtimeCase: "reset",
    status: "PLANNED",
    geminiFiles: []
  }
] as const satisfies readonly CliCommandDescriptor[];

export function implementedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "IMPLEMENTED");
}

export function plannedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "PLANNED");
}

export function expectedGeminiCommandFiles(): readonly GeminiCommandFile[] {
  return Array.from(new Set(CLI_COMMAND_REGISTRY.flatMap((command) => command.geminiFiles))).sort();
}
