import { describe, test, expect } from 'bun:test';
import { executeIsolatedCommand } from '../../src/execution/command-runner';

describe('EXEC-001 Isolated Command Runner', () => {
  test('executes command as explicit argument vector', async () => {
    const result = await executeIsolatedCommand({
      executable: 'bun',
      args: ['--version'],
    });

    expect(result.executedAsArgv).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.output).toContain('1.3.14');
  });
});
