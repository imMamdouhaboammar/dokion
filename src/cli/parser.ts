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
  "findings"
]);

const CATALOG_COMMANDS = new Set<CliCatalogCommand>(["tools", "skills", "plugins", "loops"]);
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

  if (rawCommand === "validate") {
    const parsed = parseTokens(rawCommand, tokens, { "--catalog-only": { kind: "boolean" } });
    requireNoPositionals(rawCommand, parsed.positionals);
    return {
      command: "validate",
      catalogOnly: parsed.options.get("--catalog-only") === true,
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

  if (SIMPLE_COMMANDS.has(rawCommand as CliSimpleCommand)) {
    const parsed = parseTokens(rawCommand, tokens, {});
    requireNoPositionals(rawCommand, parsed.positionals);
    return { command: rawCommand as CliSimpleCommand, format: outputFormat(rawCommand, parsed.options) };
  }

  throw new DokionError("UNSUPPORTED_EXECUTION", `Runtime parser missing for registered command: ${rawCommand}`, {
    command: rawCommand
  });
}
