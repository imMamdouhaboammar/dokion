export type CliCommandStatus = "IMPLEMENTED" | "PLANNED";
export type CliHelpGroup = "Observe" | "Configure" | "Execute";
export type CliExecutionMode = "READ_ONLY" | "CONFIGURE" | "EXECUTE" | "DECIDE" | "VERIFY_ONLY" | "REPORT_ONLY";
export type CliApprovalClass = "NONE" | "BEFORE_WRITE" | "FROM_PLAYBOOK" | "ALWAYS" | "DECISION_RECORD";
export type ManifestCommandMode = "READ_ONLY" | "VERIFY_ONLY" | "REPORT_ONLY";
export type ManifestApprovalClass = "BEFORE_WRITE" | "FROM_PLAYBOOK" | "ALWAYS";
export type GeminiCommandFile = "run.toml" | "status.toml";

export interface ManifestCliCommand {
  command: `dokion ${string}`;
  usage?: string;
  purpose: string;
  mode?: ManifestCommandMode;
  writes?: string[];
  approval?: ManifestApprovalClass;
}

export interface CliCommandDescriptor {
  id: string;
  manifestCommand: `dokion ${string}`;
  manifestUsage?: string;
  purpose: string;
  manifestMode?: ManifestCommandMode;
  manifestWrites?: readonly string[];
  manifestApproval?: ManifestApprovalClass;
  specMarker: string;
  runtimeCase: string;
  helpLine: string;
  helpGroup: CliHelpGroup;
  helpOrder: number;
  status: CliCommandStatus;
  executionMode: CliExecutionMode;
  writeScope: readonly string[];
  approvalClass: CliApprovalClass;
  geminiFiles: readonly GeminiCommandFile[];
  geminiOrder?: number;
}

export const CLI_BUILTIN_CASES = ["help", "--help", "-h"] as const;

export const CLI_COMMAND_REGISTRY = [
  {
    id: "init",
    manifestCommand: "dokion init",
    purpose: "Create Dokion state, playbook, and HARDENING.md without installing third-party capabilities.",
    manifestWrites: [".dokion/**", "HARDENING.md"],
    manifestApproval: "BEFORE_WRITE",
    specMarker: "`dokion init`",
    runtimeCase: "init",
    helpLine: "  init",
    helpGroup: "Configure",
    helpOrder: 1,
    status: "IMPLEMENTED",
    executionMode: "CONFIGURE",
    writeScope: [".dokion/**", "HARDENING.md"],
    approvalClass: "BEFORE_WRITE",
    geminiFiles: []
  },
  {
    id: "inspect",
    manifestCommand: "dokion inspect",
    purpose: "Detect stack, project profile, scripts, CI, UI, API, database, and deployment surfaces.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion inspect`",
    runtimeCase: "inspect",
    helpLine: "  inspect",
    helpGroup: "Observe",
    helpOrder: 1,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "configure",
    manifestCommand: "dokion configure",
    purpose: "Edit the user-controlled capability selection, order, permissions, and gates.",
    manifestWrites: [".dokion/playbook.json"],
    manifestApproval: "ALWAYS",
    specMarker: "`dokion configure`",
    runtimeCase: "configure",
    helpLine: "  configure",
    helpGroup: "Configure",
    helpOrder: 3,
    status: "PLANNED",
    executionMode: "CONFIGURE",
    writeScope: [".dokion/playbook.json"],
    approvalClass: "ALWAYS",
    geminiFiles: []
  },
  {
    id: "validate",
    manifestCommand: "dokion validate",
    purpose: "Validate the playbook, capability availability, permissions, dependencies, and command templates.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion validate`",
    runtimeCase: "validate",
    helpLine: "  validate [--catalog-only]",
    helpGroup: "Configure",
    helpOrder: 4,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: ["run.toml"],
    geminiOrder: 2
  },
  {
    id: "doctor",
    manifestCommand: "dokion doctor",
    purpose: "Check agent adapters, CLIs, MCP servers, credentials, runtimes, and local prerequisites.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion doctor`",
    runtimeCase: "doctor",
    helpLine: "  doctor",
    helpGroup: "Observe",
    helpOrder: 2,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: ["run.toml"],
    geminiOrder: 1
  },
  {
    id: "plan",
    manifestCommand: "dokion plan",
    purpose: "Render the exact approved loop order without executing it.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion plan`",
    runtimeCase: "plan",
    helpLine: "  plan",
    helpGroup: "Configure",
    helpOrder: 2,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "run",
    manifestCommand: "dokion run",
    manifestUsage: "dokion run [loop-id|all]",
    purpose: "Run an approved loop from its first incomplete step.",
    manifestApproval: "FROM_PLAYBOOK",
    specMarker: "`dokion run`",
    runtimeCase: "run",
    helpLine: "  run",
    helpGroup: "Execute",
    helpOrder: 1,
    status: "IMPLEMENTED",
    executionMode: "EXECUTE",
    writeScope: ["PLAYBOOK_DECLARED", ".dokion/**", "HARDENING.md"],
    approvalClass: "FROM_PLAYBOOK",
    geminiFiles: ["run.toml"],
    geminiOrder: 3
  },
  {
    id: "step",
    manifestCommand: "dokion step",
    manifestUsage: "dokion step <step-id>",
    purpose: "Run one approved step only.",
    manifestApproval: "FROM_PLAYBOOK",
    specMarker: "`dokion step`",
    runtimeCase: "step",
    helpLine: "  step <step-id>",
    helpGroup: "Execute",
    helpOrder: 2,
    status: "PLANNED",
    executionMode: "EXECUTE",
    writeScope: ["PLAYBOOK_DECLARED", ".dokion/**", "HARDENING.md"],
    approvalClass: "FROM_PLAYBOOK",
    geminiFiles: []
  },
  {
    id: "resume",
    manifestCommand: "dokion resume",
    purpose: "Resume from the last valid state and exact Git commit context.",
    specMarker: "`dokion resume`",
    runtimeCase: "resume",
    helpLine: "  resume",
    helpGroup: "Execute",
    helpOrder: 3,
    status: "IMPLEMENTED",
    executionMode: "EXECUTE",
    writeScope: ["PLAYBOOK_DECLARED", ".dokion/**", "HARDENING.md"],
    approvalClass: "FROM_PLAYBOOK",
    geminiFiles: []
  },
  {
    id: "status",
    manifestCommand: "dokion status",
    purpose: "Show loop state, current step, blockers, findings, and readiness.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion status`",
    runtimeCase: "status",
    helpLine: "  status",
    helpGroup: "Observe",
    helpOrder: 3,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: ["status.toml"],
    geminiOrder: 1
  },
  {
    id: "approve",
    manifestCommand: "dokion approve",
    manifestUsage: "dokion approve <approval-id>",
    purpose: "Record explicit user approval for an installation, write, fix, commit, or gate exception.",
    specMarker: "`dokion approve`",
    runtimeCase: "approve",
    helpLine: "  approve <step:id|finding:id> --by <identity> [--notes <text>]",
    helpGroup: "Execute",
    helpOrder: 5,
    status: "IMPLEMENTED",
    executionMode: "DECIDE",
    writeScope: [".dokion/**", "HARDENING.md"],
    approvalClass: "DECISION_RECORD",
    geminiFiles: []
  },
  {
    id: "reject",
    manifestCommand: "dokion reject",
    manifestUsage: "dokion reject <approval-id> --reason <text>",
    purpose: "Reject a pending action and record the reason.",
    specMarker: "`reject`",
    runtimeCase: "reject",
    helpLine: "  reject <step:id|finding:id> --by <identity> [--notes <text>]",
    helpGroup: "Execute",
    helpOrder: 6,
    status: "IMPLEMENTED",
    executionMode: "DECIDE",
    writeScope: [".dokion/**", "HARDENING.md"],
    approvalClass: "DECISION_RECORD",
    geminiFiles: []
  },
  {
    id: "skip",
    manifestCommand: "dokion skip",
    manifestUsage: "dokion skip <step-id> --reason <text>",
    purpose: "Skip an optional step with an auditable reason.",
    manifestApproval: "ALWAYS",
    specMarker: "`skip`",
    runtimeCase: "skip",
    helpLine: "  skip <step-id> --reason <text>",
    helpGroup: "Execute",
    helpOrder: 7,
    status: "PLANNED",
    executionMode: "DECIDE",
    writeScope: [".dokion/**", "HARDENING.md"],
    approvalClass: "ALWAYS",
    geminiFiles: []
  },
  {
    id: "findings",
    manifestCommand: "dokion findings",
    manifestUsage: "dokion findings [--severity HIGH] [--status OPEN]",
    purpose: "List normalized findings and evidence.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion findings`",
    runtimeCase: "findings",
    helpLine: "  findings",
    helpGroup: "Observe",
    helpOrder: 4,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: ["status.toml"],
    geminiOrder: 2
  },
  {
    id: "verify",
    manifestCommand: "dokion verify",
    purpose: "Run configured verification gates without applying fixes.",
    manifestMode: "VERIFY_ONLY",
    specMarker: "`dokion verify`",
    runtimeCase: "verify",
    helpLine: "  verify",
    helpGroup: "Execute",
    helpOrder: 4,
    status: "IMPLEMENTED",
    executionMode: "VERIFY_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "report",
    manifestCommand: "dokion report",
    manifestUsage: "dokion report [--format markdown|json]",
    purpose: "Regenerate HARDENING.md and machine-readable reports.",
    manifestMode: "REPORT_ONLY",
    specMarker: "`dokion report`",
    runtimeCase: "report",
    helpLine: "  report",
    helpGroup: "Observe",
    helpOrder: 5,
    status: "IMPLEMENTED",
    executionMode: "REPORT_ONLY",
    writeScope: ["HARDENING.md"],
    approvalClass: "NONE",
    geminiFiles: ["status.toml"],
    geminiOrder: 3
  },
  {
    id: "tools-list",
    manifestCommand: "dokion tools list",
    purpose: "List declared tools and their availability.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion tools list`",
    runtimeCase: "tools",
    helpLine: "  tools list",
    helpGroup: "Observe",
    helpOrder: 6,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "skills-list",
    manifestCommand: "dokion skills list",
    purpose: "List declared Skills and their approval status.",
    manifestMode: "READ_ONLY",
    specMarker: "`skills list`",
    runtimeCase: "skills",
    helpLine: "  skills list",
    helpGroup: "Observe",
    helpOrder: 7,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "plugins-list",
    manifestCommand: "dokion plugins list",
    purpose: "List declared Plugins, MCP servers, and agent adapters.",
    manifestMode: "READ_ONLY",
    specMarker: "`plugins list`",
    runtimeCase: "plugins",
    helpLine: "  plugins list",
    helpGroup: "Observe",
    helpOrder: 8,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "loops-list",
    manifestCommand: "dokion loops list",
    purpose: "List configured loops and ordered stages.",
    manifestMode: "READ_ONLY",
    specMarker: "`loops list`",
    runtimeCase: "loops",
    helpLine: "  loops list",
    helpGroup: "Observe",
    helpOrder: 9,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "loop",
    manifestCommand: "dokion loop",
    purpose: "Run loop engineering tools: audit, init, cost, sync, context.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion loop`",
    runtimeCase: "loop",
    helpLine: "  loop <audit|init|cost|sync|context>",
    helpGroup: "Observe",
    helpOrder: 10,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [".dokion/**", "HARDENING.md", "STATE.md", "LOOP.md", "loop-budget.md"],
    approvalClass: "BEFORE_WRITE",
    geminiFiles: ["status.toml"],
    geminiOrder: 4
  },
  {
    id: "goals-list",
    manifestCommand: "dokion goals list",
    purpose: "List active goals, patterns, and verifier status.",
    manifestMode: "READ_ONLY",
    specMarker: "`goals list`",
    runtimeCase: "goals",
    helpLine: "  goals list",
    helpGroup: "Observe",
    helpOrder: 10,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [],
    approvalClass: "NONE",
    geminiFiles: []
  },
  {
    id: "goal",
    manifestCommand: "dokion goal",
    purpose: "Run goal engineering tools: audit, init, estimate, status, pause, resume, clear, sync, run.",
    manifestMode: "READ_ONLY",
    specMarker: "`dokion goal`",
    runtimeCase: "goal",
    helpLine: "  goal <audit|init|estimate|status|pause|resume|clear|sync|run>",
    helpGroup: "Observe",
    helpOrder: 11,
    status: "IMPLEMENTED",
    executionMode: "READ_ONLY",
    writeScope: [".dokion/**", "HARDENING.md", "GOAL.md", "goal-budget.md", "goal-run-log.md"],
    approvalClass: "BEFORE_WRITE",
    geminiFiles: ["goal.toml", "status.toml"],
    geminiOrder: 5
  },
  {
    id: "reset-state",
    manifestCommand: "dokion reset --state-only",
    purpose: "Reset execution state without deleting findings, evidence, or the user playbook.",
    manifestApproval: "ALWAYS",
    specMarker: "`dokion reset --state-only`",
    runtimeCase: "reset",
    helpLine: "  reset --state-only",
    helpGroup: "Configure",
    helpOrder: 5,
    status: "PLANNED",
    executionMode: "CONFIGURE",
    writeScope: [".dokion/state.json", ".dokion/runs/**", "HARDENING.md"],
    approvalClass: "ALWAYS",
    geminiFiles: []
  }
] as const satisfies readonly CliCommandDescriptor[];

const HELP_GROUPS = ["Observe", "Configure", "Execute"] as const satisfies readonly CliHelpGroup[];

export function implementedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "IMPLEMENTED");
}

export function plannedCliCommands(): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => command.status === "PLANNED");
}

export function resolveCliCommand(command: string): CliCommandDescriptor | undefined {
  return CLI_COMMAND_REGISTRY.find((candidate) => candidate.runtimeCase === command);
}

export function renderCliHelp(version: string): string {
  const sections = HELP_GROUPS.map((group) => {
    const lines = implementedCliCommands()
      .filter((command) => command.helpGroup === group)
      .sort((left, right) => left.helpOrder - right.helpOrder)
      .map((command) => command.helpLine);
    return `${group}:\n${lines.join("\n")}`;
  });

  return `Dokion ${version}\n\nUsage: dokion <command> [--format human|json]\n\n${sections.join("\n\n")}\n\nDokion never installs, selects, substitutes, reorders, or enables capabilities.`;
}

export function manifestCliCommands(): ManifestCliCommand[] {
  return CLI_COMMAND_REGISTRY.map((command) => {
    const result: ManifestCliCommand = {
      command: command.manifestCommand,
      purpose: command.purpose
    };
    if ("manifestUsage" in command) result.usage = command.manifestUsage;
    if ("manifestMode" in command) result.mode = command.manifestMode;
    if ("manifestWrites" in command) result.writes = [...command.manifestWrites];
    if ("manifestApproval" in command) result.approval = command.manifestApproval;
    return result;
  });
}

export function expectedGeminiCommandFiles(): readonly GeminiCommandFile[] {
  return Array.from(new Set(CLI_COMMAND_REGISTRY.flatMap((command) => command.geminiFiles))).sort();
}

export function geminiCommandsForFile(file: GeminiCommandFile): readonly CliCommandDescriptor[] {
  return CLI_COMMAND_REGISTRY.filter((command) => {
    const files: readonly GeminiCommandFile[] = command.geminiFiles;
    return files.includes(file);
  }).sort((left, right) => {
      const leftOrder = "geminiOrder" in left ? left.geminiOrder : Number.MAX_SAFE_INTEGER;
      const rightOrder = "geminiOrder" in right ? right.geminiOrder : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
}
