import type { ApprovalSubjectType } from "../approvals/approval-store.ts";
import { DokionError } from "../core/errors.ts";
import { resolveCliCommand } from "./command-registry.ts";
import type { CliCatalogCommand, CliInvocation, CliOutputFormat, CliSimpleCommand } from "./types.ts";

interface OptionSpec {
  kind: "boolean" | "value";
}

interface ParsedTokens {
  positionals: string[];
  options: Map<string, true | string>;
}

const APPROVAL_SUBJECT_TYPES = new Set<ApprovalSubjectType>([
  "step",
  "finding",
  "fix",
  "commit",
  "install",
  "suggestion",
  "deferral"
]);

const SIMPLE_COMMANDS = new Set<CliSimpleCommand>([
  "init",
  "inspect",
  "doctor",
  "plan",
  "run",
  "resume",
  "verify",
  "status",
  "report",
  "findings",
  "configure",
  "audit"
]);

const CATALOG_COMMANDS = new Set<CliCatalogCommand>(["tools", "skills", "plugins", "loops", "goals"]);
const GLOBAL_OPTION_SPECS: Readonly<Record<string, OptionSpec>> = { "--format": { kind: "value" } };

function parseTokens(command: string, tokens: readonly string[], specs: Readonly<Record<string, OptionSpec>>): ParsedTokens {
  const positionals: string[] = [];
  const options = new Map<string, true | string>();

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }

    const spec = specs[token] ?? GLOBAL_OPTION_SPECS[token];
    if (!spec) {
      throw new DokionError("CLI_UNKNOWN_OPTION", `Unknown option for ${command}: ${token}`, {
        command,
        option: token
      });
    }
    if (options.has(token)) {
      throw new DokionError("CLI_DUPLICATE_OPTION", `Option may be provided only once: ${token}`, {
        command,
        option: token
      });
    }
    if (spec.kind === "boolean") {
      options.set(token, true);
      continue;
    }

    const value = tokens[index + 1];
    if (!value || value.startsWith("-")) {
      throw new DokionError("CLI_MISSING_OPTION_VALUE", `Option requires a value: ${token}`, {
        command,
        option: token
      });
    }
    options.set(token, value);
    index += 1;
  }

  return { positionals, options };
}

function requireNoPositionals(command: string, positionals: readonly string[]): void {
  if (positionals.length === 0) return;
  throw new DokionError("CLI_INVALID_ARGUMENT", `Command does not accept positional arguments: ${command}`, {
    command,
    arguments: [...positionals]
  });
}

function parseApprovalSubject(command: "approve" | "reject", value: string | undefined): {
  subject: string;
  subjectType: ApprovalSubjectType;
} {
  if (!value) {
    throw new DokionError("CLI_MISSING_ARGUMENT", `Missing approval subject for ${command}`, {
      command,
      argument: "subject"
    });
  }

  const match = /^([a-z]+):([A-Za-z0-9][A-Za-z0-9._/-]*)$/.exec(value);
  const subjectType = match?.[1] as ApprovalSubjectType | undefined;
  if (!match || !subjectType || !APPROVAL_SUBJECT_TYPES.has(subjectType)) {
    throw new DokionError("CLI_INVALID_ARGUMENT", `Invalid approval subject: ${value}`, {
      command,
      argument: "subject",
      value
    });
  }
  return { subject: value, subjectType };
}

function requiredOption(command: string, options: ReadonlyMap<string, true | string>, name: string): string {
  const value = options.get(name);
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new DokionError("CLI_MISSING_ARGUMENT", `Missing required option for ${command}: ${name}`, {
    command,
    option: name
  });
}

function outputFormat(command: string, options: ReadonlyMap<string, true | string>): CliOutputFormat {
  const value = options.get("--format");
  if (value === undefined) return "human";
  if (value === "human" || value === "json") return value;
  throw new DokionError("CLI_INVALID_ARGUMENT", `Unsupported output format: ${String(value)}`, {
    command,
    option: "--format",
    value
  });
}

export function requestedCliOutputFormat(argv: readonly string[]): CliOutputFormat {
  for (let index = 0; index < argv.length - 1; index += 1) {
    if (argv[index] === "--format" && argv[index + 1] === "json") return "json";
  }
  return "human";
}

export function parseCliInvocation(argv: readonly string[]): CliInvocation {
  const [rawCommand = "help", ...tokens] = argv;
  if (["help", "--help", "-h"].includes(rawCommand)) {
    const parsed = parseTokens("help", tokens, {});
    requireNoPositionals("help", parsed.positionals);
    return { command: "help", format: outputFormat("help", parsed.options) };
  }

  const descriptor = resolveCliCommand(rawCommand);
  if (!descriptor) {
    throw new DokionError("CLI_UNKNOWN_COMMAND", `Unknown command: ${rawCommand}`, {
      command: rawCommand
    });
  }
  if (descriptor.status === "PLANNED") {
    throw new DokionError("CLI_PLANNED_COMMAND", `Command is planned but not implemented: ${descriptor.manifestCommand}`, {
      command: rawCommand,
      manifestCommand: descriptor.manifestCommand
    });
  }

  if (rawCommand === "registry") {
    const subcommand = tokens[0];
    if (subcommand === "pack") {
      const parsed = parseTokens(rawCommand, tokens.slice(1), {
        "--output": { kind: "value" },
        "--overwrite": { kind: "boolean" }
      });
      if (parsed.positionals.length === 0) {
        throw new DokionError("CLI_MISSING_ARGUMENT", "Missing source directory for dokion registry pack <directory> --output <path>", {
          command: rawCommand,
          subcommand,
          argument: "directory"
        });
      }
      if (parsed.positionals.length > 1) {
        throw new DokionError("CLI_INVALID_ARGUMENT", "dokion registry pack accepts exactly one source directory.", {
          command: rawCommand,
          subcommand,
          arguments: parsed.positionals
        });
      }
      return {
        command: "registry",
        subcommand: "pack",
        directory: parsed.positionals[0]!,
        output: requiredOption(rawCommand, parsed.options, "--output"),
        overwrite: parsed.options.get("--overwrite") === true,
        format: outputFormat(rawCommand, parsed.options)
      };
    }

    if (subcommand === "pull") {
      const parsed = parseTokens(rawCommand, tokens.slice(1), {
        "--source": { kind: "value" },
        "--config": { kind: "value" },
        "--cache": { kind: "value" }
      });
      if (parsed.positionals.length === 0) {
        throw new DokionError(
          "CLI_MISSING_ARGUMENT",
          "Missing exact package reference for dokion registry pull <namespace/name@version>",
          { command: rawCommand, subcommand, argument: "package-reference" }
        );
      }
      if (parsed.positionals.length > 1) {
        throw new DokionError("CLI_INVALID_ARGUMENT", "dokion registry pull accepts exactly one package reference.", {
          command: rawCommand,
          subcommand,
          arguments: parsed.positionals
        });
      }
      return {
        command: "registry",
        subcommand: "pull",
        packageReference: parsed.positionals[0]!,
        source: requiredOption(rawCommand, parsed.options, "--source"),
        configPath: requiredOption(rawCommand, parsed.options, "--config"),
        cacheRoot: requiredOption(rawCommand, parsed.options, "--cache"),
        format: outputFormat(rawCommand, parsed.options)
      };
    }

    if (subcommand === "verify-package") {
      const parsed = parseTokens(rawCommand, tokens.slice(1), {
        "--package": { kind: "value" },
        "--version": { kind: "value" }
      });
      if (parsed.positionals.length === 0) {
        throw new DokionError("CLI_MISSING_ARGUMENT", "Missing archive path for dokion registry verify-package <archive>", {
          command: rawCommand,
          subcommand,
          argument: "archive"
        });
      }
      if (parsed.positionals.length > 1) {
        throw new DokionError("CLI_INVALID_ARGUMENT", "dokion registry verify-package accepts exactly one archive path.", {
          command: rawCommand,
          subcommand,
          arguments: parsed.positionals
        });
      }
      const expectedPackageId = parsed.options.get("--package");
      const expectedVersion = parsed.options.get("--version");
      return {
        command: "registry",
        subcommand: "verify-package",
        archive: parsed.positionals[0]!,
        ...(typeof expectedPackageId === "string" ? { expectedPackageId } : {}),
        ...(typeof expectedVersion === "string" ? { expectedVersion } : {}),
        format: outputFormat(rawCommand, parsed.options)
      };
    }

    throw new DokionError(
      "CLI_INVALID_ARGUMENT",
      "Usage: dokion registry <pack|verify-package|pull> ...",
      { command: rawCommand, subcommand }
    );
  }

  if (rawCommand === "validate") {
    const parsed = parseTokens(rawCommand, tokens, { "--catalog-only": { kind: "boolean" } });
    requireNoPositionals(rawCommand, parsed.positionals);
    return {
      command: "validate",
      catalogOnly: parsed.options.get("--catalog-only") === true,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "step") {
    const parsed = parseTokens(rawCommand, tokens, {});
    const stepId = parsed.positionals[0];
    if (!stepId) {
      throw new DokionError("CLI_MISSING_ARGUMENT", "Missing step ID for dokion step <step-id>", {
        command: rawCommand,
        argument: "step-id"
      });
    }
    return {
      command: "step",
      stepId,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "skip") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--reason": { kind: "value" },
      "--by": { kind: "value" }
    });
    const stepId = parsed.positionals[0];
    if (!stepId) {
      throw new DokionError("CLI_MISSING_ARGUMENT", "Missing step ID for dokion skip <step-id> --reason <text>", {
        command: rawCommand,
        argument: "step-id"
      });
    }
    const reason = requiredOption(rawCommand, parsed.options, "--reason");
    const by = parsed.options.get("--by");
    return {
      command: "skip",
      stepId,
      reason,
      ...(typeof by === "string" ? { by } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "reset") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--state-only": { kind: "boolean" }
    });
    if (parsed.options.get("--state-only") !== true) {
      throw new DokionError("CLI_INVALID_ARGUMENT", "dokion reset requires --state-only flag", {
        command: rawCommand
      });
    }
    return {
      command: "reset",
      stateOnly: true,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "approve" || rawCommand === "reject") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--by": { kind: "value" },
      "--notes": { kind: "value" }
    });
    if (parsed.positionals.length > 1) {
      throw new DokionError("CLI_INVALID_ARGUMENT", `Too many approval subjects for ${rawCommand}`, {
        command: rawCommand,
        arguments: parsed.positionals
      });
    }
    const approval = parseApprovalSubject(rawCommand, parsed.positionals[0]);
    const by = requiredOption(rawCommand, parsed.options, "--by");
    const notes = parsed.options.get("--notes");
    return {
      command: rawCommand,
      ...approval,
      by,
      ...(typeof notes === "string" ? { notes } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (CATALOG_COMMANDS.has(rawCommand as CliCatalogCommand)) {
    const parsed = parseTokens(rawCommand, tokens, {});
    if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "list") {
      throw new DokionError("CLI_INVALID_ARGUMENT", `Usage: dokion ${rawCommand} list`, {
        command: rawCommand,
        arguments: parsed.positionals
      });
    }
    return {
      command: rawCommand as CliCatalogCommand,
      action: "list",
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "loop") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--pattern": { kind: "value" }
    });
    const subcommand = parsed.positionals[0] as "audit" | "init" | "cost" | "sync" | "context" | undefined;
    if (!subcommand || !["audit", "init", "cost", "sync", "context"].includes(subcommand)) {
      throw new DokionError("CLI_INVALID_ARGUMENT", "Usage: dokion loop <audit|init|cost|sync|context> [--pattern <p>]", {
        command: rawCommand,
        arguments: parsed.positionals
      });
    }
    const pattern = parsed.options.get("--pattern");
    return {
      command: "loop",
      subcommand,
      ...(typeof pattern === "string" ? { pattern } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "goal") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--pattern": { kind: "value" },
      "--level": { kind: "value" },
      "--objective": { kind: "value" }
    });
    const subcommand = parsed.positionals[0] as
      | "audit"
      | "doctor"
      | "init"
      | "estimate"
      | "status"
      | "pause"
      | "resume"
      | "clear"
      | "sync"
      | "run"
      | undefined;
    const validSubs = ["audit", "doctor", "init", "estimate", "status", "pause", "resume", "clear", "sync", "run"];
    if (!subcommand || !validSubs.includes(subcommand)) {
      throw new DokionError(
        "CLI_INVALID_ARGUMENT",
        "Usage: dokion goal <audit|doctor|init|estimate|status|pause|resume|clear|sync|run> [--pattern <p>] [--level <l>] [--objective <obj>]",
        {
          command: rawCommand,
          arguments: parsed.positionals
        }
      );
    }
    const pattern = parsed.options.get("--pattern");
    const level = parsed.options.get("--level");
    const objective = parsed.options.get("--objective") || parsed.positionals.slice(1).join(" ");
    return {
      command: "goal",
      subcommand,
      ...(typeof pattern === "string" ? { pattern } : {}),
      ...(typeof level === "string" ? { level } : {}),
      ...(typeof objective === "string" && objective.length > 0 ? { objective } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "playbooks") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--from": { kind: "value" }
    });
    const subcommand = (parsed.positionals[0] || "list") as "import" | "validate" | "sync" | "list";
    const from = parsed.options.get("--from");
    return {
      command: "playbooks",
      subcommand,
      ...(typeof from === "string" ? { from } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "hooks") {
    const parsed = parseTokens(rawCommand, tokens, {});
    const subcommand = (parsed.positionals[0] || "status") as "run" | "status";
    return {
      command: "hooks",
      subcommand,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "autopilot") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--dry-run": { kind: "boolean" },
      "--max-turns": { kind: "value" }
    });
    const maxTurnsStr = parsed.options.get("--max-turns");
    const maxTurns = typeof maxTurnsStr === "string" ? parseInt(maxTurnsStr, 10) : undefined;
    return {
      command: "autopilot",
      dryRun: parsed.options.get("--dry-run") === true,
      ...(maxTurns && !isNaN(maxTurns) ? { maxTurns } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "memory") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--pattern": { kind: "value" },
      "--tool": { kind: "value" },
      "--force": { kind: "boolean" },
      "--with-loop": { kind: "boolean" },
      "--suggest": { kind: "boolean" }
    });
    const subcommand = (parsed.positionals[0] || "audit") as "audit" | "init" | "status" | "patterns";
    const pattern = parsed.options.get("--pattern");
    const tool = parsed.options.get("--tool");
    return {
      command: "memory",
      subcommand,
      ...(typeof pattern === "string" ? { pattern } : {}),
      ...(typeof tool === "string" ? { tool } : {}),
      force: parsed.options.get("--force") === true,
      withLoop: parsed.options.get("--with-loop") === true,
      suggest: parsed.options.get("--suggest") === true,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "compare" || rawCommand === "diff") {
    const parsed = parseTokens(rawCommand, tokens, {});
    const baselineRunId = parsed.positionals[0];
    const targetRunId = parsed.positionals[1];
    return {
      command: "compare",
      ...(baselineRunId ? { baselineRunId } : {}),
      ...(targetRunId ? { targetRunId } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "auto-runner") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--max-turns": { kind: "value" },
      "--target": { kind: "value" },
      "--max-cost": { kind: "value" },
      "--disable-circuit-breaker": { kind: "boolean" }
    });
    const flags = new Set<string>();
    if (parsed.options.get("--disable-circuit-breaker") === true) flags.add("disable-circuit-breaker");
    return {
      command: "auto-runner",
      options: parsed.options,
      flags,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "autoresearch") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--auto": { kind: "boolean" },
      "--classic": { kind: "boolean" },
      "--dry-run": { kind: "boolean" },
      "--max-cycles": { kind: "value" },
      "--evals": { kind: "boolean" }
    });
    const flags = new Set<string>();
    if (parsed.options.get("--auto") === true) flags.add("auto");
    if (parsed.options.get("--classic") === true) flags.add("classic");
    if (parsed.options.get("--dry-run") === true) flags.add("dry-run");
    if (parsed.options.get("--evals") === true) flags.add("evals");

    return {
      command: "autoresearch",
      positionals: parsed.positionals,
      options: parsed.options,
      flags,
      dryRun: parsed.options.get("--dry-run") === true,
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (rawCommand === "create" || rawCommand === "creator") {
    const parsed = parseTokens(rawCommand, tokens, {
      "--from-memory": { kind: "value" },
      "--transcript": { kind: "value" },
      "--topic": { kind: "value" },
      "--output": { kind: "value" }
    });
    const fromMemory = parsed.options.get("--from-memory") as string | undefined;
    const transcript = parsed.options.get("--transcript") as string | undefined;
    const topic = parsed.options.get("--topic") as string | undefined;
    const output = parsed.options.get("--output") as string | undefined;

    return {
      command: "create",
      ...(fromMemory ? { fromMemory } : {}),
      ...(transcript ? { transcript } : {}),
      ...(topic ? { topic } : {}),
      ...(output ? { output } : {}),
      format: outputFormat(rawCommand, parsed.options)
    };
  }

  if (SIMPLE_COMMANDS.has(rawCommand as CliSimpleCommand)) {
    const parsed = parseTokens(rawCommand, tokens, {});
    requireNoPositionals(rawCommand, parsed.positionals);
    return { command: rawCommand as CliSimpleCommand, format: outputFormat(rawCommand, parsed.options) };
  }

  throw new DokionError("UNSUPPORTED_EXECUTION", `Runtime parser missing for registered command: ${rawCommand}`, {
    command: rawCommand
  });
}
