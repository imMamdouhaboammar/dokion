import type { DokionState } from '../state/types';

export interface VerifyGateOptions {
  gates?: Array<{ id: string; command: string }>;
  dryRun?: boolean;
}

export interface VerifyGateResult {
  gateId: string;
  command: string;
  passed: boolean;
  exitCode: number;
}

export interface VerifyRunResult {
  passed: boolean;
  results: VerifyGateResult[];
  message: string;
}

export async function verifyConfiguredGates(
  options: VerifyGateOptions,
  state: DokionState | null
): Promise<VerifyRunResult> {
  const gates = options.gates ?? [
    { id: 'gate-typecheck', command: 'bun run typecheck' },
    { id: 'gate-tests', command: 'bun test' },
  ];

  const results: VerifyGateResult[] = [];
  let allPassed = true;

  for (const gate of gates) {
    if (options.dryRun) {
      results.push({
        gateId: gate.id,
        command: gate.command,
        passed: true,
        exitCode: 0,
      });
      continue;
    }

    const [cmd, ...args] = gate.command.split(' ');
    const child = Bun.spawn([cmd!, ...args], {
      stdout: 'ignore',
      stderr: 'ignore',
    });

    const exitCode = await child.exited;
    const passed = exitCode === 0;

    if (!passed) {
      allPassed = false;
    }

    results.push({
      gateId: gate.id,
      command: gate.command,
      passed,
      exitCode,
    });
  }

  return {
    passed: allPassed,
    results,
    message: allPassed
      ? 'All configured verification gates passed successfully'
      : 'One or more verification gates failed',
  };
}
