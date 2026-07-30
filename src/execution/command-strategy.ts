import { DokionError } from "../core/errors.ts";

export type CommandDeclaration =
  | {
      kind: "ARGV";
      executable: string;
      args?: readonly string[];
    }
  | {
      kind: "SHELL";
      command: string;
    };

export type CommandStrategyDegradation =
  | "LEGACY_SHELL_COMMAND"
  | "UNPROVEN_PLATFORM_COMMAND_STRATEGY";

export interface SupportedCommandStrategy {
  supported: true;
  platform: string;
  strategy: "DIRECT_ARGV" | "POSIX_SHELL";
  spawnArgv: string[];
  shellParsing: boolean;
  processGroup: "POSIX_NEW_GROUP";
  degradations: CommandStrategyDegradation[];
}

export interface UnsupportedCommandStrategy {
  supported: false;
  platform: string;
  strategy: "UNSUPPORTED";
  shellParsing: false;
  processGroup: "UNSUPPORTED";
  degradations: ["UNPROVEN_PLATFORM_COMMAND_STRATEGY"];
  reason: string;
}

export type CommandStrategyResult = SupportedCommandStrategy | UnsupportedCommandStrategy;

const SUPPORTED_POSIX_PLATFORMS = new Set(["darwin", "linux"]);

function invalidCommand(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Command declaration is invalid: ${reason}`, { field });
}

function requireProcessString(field: string, value: string): string {
  if (value.trim().length === 0) invalidCommand(field, `${field} is empty`);
  if (value.includes("\u0000")) invalidCommand(field, `${field} contains a null byte`);
  return value;
}

function normalizeArgv(command: Extract<CommandDeclaration, { kind: "ARGV" }>): string[] {
  const executable = requireProcessString("executable", command.executable);
  const args = command.args ?? [];
  for (const [index, argument] of args.entries()) {
    if (typeof argument !== "string") invalidCommand(`args[${index}]`, "argument is not a string");
    if (argument.includes("\u0000")) invalidCommand(`args[${index}]`, "argument contains a null byte");
  }
  return [executable, ...args];
}

export function resolveCommandStrategy(
  platform: string,
  command: CommandDeclaration
): CommandStrategyResult {
  if (!SUPPORTED_POSIX_PLATFORMS.has(platform)) {
    return {
      supported: false,
      platform,
      strategy: "UNSUPPORTED",
      shellParsing: false,
      processGroup: "UNSUPPORTED",
      degradations: ["UNPROVEN_PLATFORM_COMMAND_STRATEGY"],
      reason: `No proven command strategy exists for platform ${platform}`
    };
  }

  if (command.kind === "ARGV") {
    return {
      supported: true,
      platform,
      strategy: "DIRECT_ARGV",
      spawnArgv: normalizeArgv(command),
      shellParsing: false,
      processGroup: "POSIX_NEW_GROUP",
      degradations: []
    };
  }

  const shellCommand = requireProcessString("command", command.command);
  return {
    supported: true,
    platform,
    strategy: "POSIX_SHELL",
    spawnArgv: ["/bin/sh", "-c", shellCommand],
    shellParsing: true,
    processGroup: "POSIX_NEW_GROUP",
    degradations: ["LEGACY_SHELL_COMMAND"]
  };
}
