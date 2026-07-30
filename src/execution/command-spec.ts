import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";

export interface ArgumentVectorCommandInput {
  executable: string;
  args?: readonly string[];
}

export type CommandSpecInput = string | ArgumentVectorCommandInput;

export interface NormalizedArgumentVectorCommand {
  schema_version: 1;
  kind: "ARGV";
  identity: string;
  executable: string;
  args: string[];
  risk: "LOWER";
  degradations: [];
  evidence: {
    executable: string;
    args: string[];
  };
}

export interface NormalizedShellCommand {
  schema_version: 1;
  kind: "SHELL";
  identity: string;
  command: string;
  risk: "HIGHER";
  degradations: ["LEGACY_SHELL_COMMAND"];
  evidence: {
    legacy_shell_command: string;
  };
}

export type NormalizedCommandSpec = NormalizedArgumentVectorCommand | NormalizedShellCommand;

function invalid(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Command specification is invalid: ${reason}`, { field });
}

function requireProcessString(field: string, value: unknown, allowEmpty = false): string {
  if (typeof value !== "string") invalid(field, `${field} must be a string`);
  if (!allowEmpty && value.trim().length === 0) invalid(field, `${field} is empty`);
  if (value.includes("\u0000")) invalid(field, `${field} contains a null byte`);
  return value;
}

function commandIdentity(value: Record<string, unknown>): string {
  return sha256(JSON.stringify(value));
}

function normalizeArgv(value: Record<string, unknown>): NormalizedArgumentVectorCommand {
  const keys = Object.keys(value).sort();
  const unsupported = keys.filter((key) => key !== "executable" && key !== "args");
  if (unsupported.length > 0) invalid(unsupported[0]!, `unsupported field ${unsupported[0]}`);

  const executable = requireProcessString("executable", value.executable);
  const rawArgs = value.args ?? [];
  if (!Array.isArray(rawArgs)) invalid("args", "args must be an array");
  const args = rawArgs.map((argument, index) => requireProcessString(`args[${index}]`, argument, true));
  const identity = commandIdentity({ kind: "ARGV", executable, args });

  return {
    schema_version: 1,
    kind: "ARGV",
    identity,
    executable,
    args: [...args],
    risk: "LOWER",
    degradations: [],
    evidence: {
      executable,
      args: [...args]
    }
  };
}

export function normalizeCommandSpec(input: unknown): NormalizedCommandSpec {
  if (typeof input === "string") {
    const command = requireProcessString("command", input);
    return {
      schema_version: 1,
      kind: "SHELL",
      identity: commandIdentity({ kind: "SHELL", command }),
      command,
      risk: "HIGHER",
      degradations: ["LEGACY_SHELL_COMMAND"],
      evidence: { legacy_shell_command: command }
    };
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    invalid("command", "command must be a legacy string or argument-vector object");
  }
  return normalizeArgv(input as Record<string, unknown>);
}
