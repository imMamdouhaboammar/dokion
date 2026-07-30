import { spoolCommandStream, type SpoolResult } from './spooler';

export interface CommandSpec {
  executable: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  maxOutputBytes?: number;
}

export interface IsolatedExecutionResult {
  exitCode: number;
  stdout: SpoolResult;
  stderr: SpoolResult;
  executedAsArgv: boolean;
}

export async function executeIsolatedCommand(spec: CommandSpec): Promise<IsolatedExecutionResult> {
  const { executable, args = [], cwd, env, maxOutputBytes = 1048576 } = spec;

  const child = Bun.spawn([executable, ...args], {
    ...(cwd ? { cwd } : {}),
    env: env ?? { PATH: process.env['PATH'] ?? '' },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    spoolCommandStream(child.stdout, maxOutputBytes),
    spoolCommandStream(child.stderr, maxOutputBytes),
  ]);

  const exitCode = await child.exited;

  return {
    exitCode,
    stdout,
    stderr,
    executedAsArgv: true,
  };
}
