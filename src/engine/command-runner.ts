import { DokionError } from "../core/errors.ts";

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}

export interface CommandOptions {
  timeoutSeconds?: number;
  env?: Record<string, string>;
}

export async function runCommand(
  root: string,
  command: string,
  options: number | CommandOptions = 300
): Promise<CommandResult> {
  const normalized: CommandOptions = typeof options === "number" ? { timeoutSeconds: options } : options;
  const timeoutSeconds = normalized.timeoutSeconds ?? 300;
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const processHandle = Bun.spawn(["bash", "-lc", command], {
    cwd: root,
    env: { ...process.env, ...(normalized.env ?? {}) },
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });

  const stdoutPromise = processHandle.stdout ? new Response(processHandle.stdout).text() : Promise.resolve("");
  const stderrPromise = processHandle.stderr ? new Response(processHandle.stderr).text() : Promise.resolve("");
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const exitCode = await Promise.race([
      processHandle.exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          processHandle.kill();
          reject(new DokionError("COMMAND_FAILED", `Command timed out after ${timeoutSeconds} seconds`, {
            command,
            timeoutSeconds
          }));
        }, timeoutSeconds * 1000);
      })
    ]);

    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
    return {
      command,
      stdout,
      stderr,
      exitCode,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - started)
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
