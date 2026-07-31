import { DokionError } from "../core/errors.ts";

export type ProcessTerminationReason =
  | "TIMEOUT"
  | "CANCELLATION"
  | "SIGNAL"
  | "BUDGET_STOP"
  | "POLICY_STOP";

export type ProcessTerminationSignal = "SIGTERM" | "SIGKILL";
export type ProcessControllerDegradation = "UNPROVEN_PROCESS_TREE_TERMINATION";

export interface ProcessTreeHandle {
  pid: number;
  exited: Promise<number>;
}

export interface ProcessControllerOptions {
  platform?: string;
  gracePeriodMs?: number;
  killWaitMs?: number;
  pollIntervalMs?: number;
  killProcessGroup?: (processGroupId: number, signal: ProcessTerminationSignal) => void;
  processGroupExists?: (processGroupId: number) => boolean;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export interface ProcessTerminationResult {
  supported: boolean;
  platform: string;
  pid: number;
  processGroupId: number | null;
  reason: ProcessTerminationReason;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  signalsSent: ProcessTerminationSignal[];
  forced: boolean;
  groupTerminated: boolean;
  alreadyExited: boolean;
  exitCode: number | null;
  degradations: ProcessControllerDegradation[];
}

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const REASONS = new Set<ProcessTerminationReason>([
  "TIMEOUT",
  "CANCELLATION",
  "SIGNAL",
  "BUDGET_STOP",
  "POLICY_STOP"
]);

function invalid(field: string, reason: string): never {
  throw new DokionError("INVALID_STATE", `Process controller input is invalid: ${reason}`, { field });
}

function requireBound(field: string, value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0 || resolved > 60_000) {
    invalid(field, `${field} must be an integer between 0 and 60000`);
  }
  return resolved;
}

function defaultGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ESRCH") return false;
      if (error.code === "EPERM") return true;
    }
    throw error;
  }
}

function defaultKillGroup(processGroupId: number, signal: ProcessTerminationSignal): void {
  process.kill(-processGroupId, signal);
}

async function waitForGroupExit(input: {
  processGroupId: number;
  timeoutMs: number;
  pollIntervalMs: number;
  exists: (processGroupId: number) => boolean;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
}): Promise<boolean> {
  const deadline = input.now() + input.timeoutMs;
  while (input.exists(input.processGroupId)) {
    const remaining = deadline - input.now();
    if (remaining <= 0) return false;
    await input.sleep(Math.min(input.pollIntervalMs, remaining));
  }
  return true;
}

async function settledExitCode(exited: Promise<number>, waitMs: number): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      exited.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), waitMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function signalGroup(
  processGroupId: number,
  signal: ProcessTerminationSignal,
  killProcessGroup: (processGroupId: number, signal: ProcessTerminationSignal) => void
): boolean {
  try {
    killProcessGroup(processGroupId, signal);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
    throw new DokionError("COMMAND_FAILED", `Failed to send ${signal} to process group`, {
      processGroupId,
      signal
    });
  }
}

export async function terminateProcessTree(
  handle: ProcessTreeHandle,
  reason: ProcessTerminationReason,
  options: ProcessControllerOptions = {}
): Promise<ProcessTerminationResult> {
  if (!Number.isSafeInteger(handle.pid) || handle.pid <= 0) invalid("pid", "pid must be a positive integer");
  if (!REASONS.has(reason)) invalid("reason", "termination reason is unsupported");

  const platform = options.platform ?? process.platform;
  const gracePeriodMs = requireBound("gracePeriodMs", options.gracePeriodMs, 1_000);
  const killWaitMs = requireBound("killWaitMs", options.killWaitMs, 1_000);
  const pollIntervalMs = requireBound("pollIntervalMs", options.pollIntervalMs, 10);
  if (pollIntervalMs === 0) invalid("pollIntervalMs", "pollIntervalMs must be greater than zero");

  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? Bun.sleep;
  const started = now();
  const startedAt = new Date(started).toISOString();

  if (!SUPPORTED_PLATFORMS.has(platform)) {
    const ended = now();
    return {
      supported: false,
      platform,
      pid: handle.pid,
      processGroupId: null,
      reason,
      startedAt,
      endedAt: new Date(ended).toISOString(),
      durationMs: Math.max(0, ended - started),
      signalsSent: [],
      forced: false,
      groupTerminated: false,
      alreadyExited: false,
      exitCode: null,
      degradations: ["UNPROVEN_PROCESS_TREE_TERMINATION"]
    };
  }

  const processGroupId = handle.pid;
  const exists = options.processGroupExists ?? defaultGroupExists;
  const killProcessGroup = options.killProcessGroup ?? defaultKillGroup;
  const signalsSent: ProcessTerminationSignal[] = [];

  if (!exists(processGroupId)) {
    const exitCode = await settledExitCode(handle.exited, 0);
    const ended = now();
    return {
      supported: true,
      platform,
      pid: handle.pid,
      processGroupId,
      reason,
      startedAt,
      endedAt: new Date(ended).toISOString(),
      durationMs: Math.max(0, ended - started),
      signalsSent,
      forced: false,
      groupTerminated: true,
      alreadyExited: true,
      exitCode,
      degradations: []
    };
  }

  if (signalGroup(processGroupId, "SIGTERM", killProcessGroup)) {
    signalsSent.push("SIGTERM");
  }
  let groupTerminated = await waitForGroupExit({
    processGroupId,
    timeoutMs: gracePeriodMs,
    pollIntervalMs,
    exists,
    sleep,
    now
  });

  let forced = false;
  if (!groupTerminated) {
    forced = true;
    if (signalGroup(processGroupId, "SIGKILL", killProcessGroup)) {
      signalsSent.push("SIGKILL");
    }
    groupTerminated = await waitForGroupExit({
      processGroupId,
      timeoutMs: killWaitMs,
      pollIntervalMs,
      exists,
      sleep,
      now
    });
  }

  if (!groupTerminated) {
    throw new DokionError("COMMAND_FAILED", "Process group survived SIGKILL", {
      processGroupId,
      reason,
      signalsSent
    });
  }

  const exitCode = await settledExitCode(handle.exited, killWaitMs);
  const ended = now();
  return {
    supported: true,
    platform,
    pid: handle.pid,
    processGroupId,
    reason,
    startedAt,
    endedAt: new Date(ended).toISOString(),
    durationMs: Math.max(0, ended - started),
    signalsSent,
    forced,
    groupTerminated,
    alreadyExited: false,
    exitCode,
    degradations: []
  };
}
