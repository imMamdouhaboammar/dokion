import {
  normalizeCommandSpec,
  type CommandSpecInput
} from "./command-spec.ts";

export function commandSpecIdentity(command: CommandSpecInput): string {
  return normalizeCommandSpec(command).identity;
}

export function commandSpecDisplay(command: CommandSpecInput): string {
  const normalized = normalizeCommandSpec(command);
  if (normalized.kind === "SHELL") return normalized.command;
  return [normalized.executable, ...normalized.args.map((argument) => JSON.stringify(argument))].join(" ");
}

export function commandSpecAllowed(
  allowed: readonly CommandSpecInput[] | undefined,
  command: CommandSpecInput
): boolean {
  const identity = commandSpecIdentity(command);
  return (allowed ?? []).some((candidate) => commandSpecIdentity(candidate) === identity);
}

export function cloneCommandSpec(command: CommandSpecInput): CommandSpecInput {
  return typeof command === "string"
    ? command
    : {
        executable: command.executable,
        ...(command.args === undefined ? {} : { args: [...command.args] })
      };
}
