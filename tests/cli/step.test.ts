import { describe, test, expect } from 'bun:test';
import { handleStepCommand } from '../../src/cli/handlers/step';

describe('CORE-008 Guarded Step Execution', () => {
  test('runs dry-run step execution cleanly', async () => {
    const result = await handleStepCommand(
      {
        stepId: 's1',
        command: 'echo',
        args: ['hello'],
        dryRun: true,
      },
      null
    );
    expect(result.status).toBe('SUCCEEDED');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('DRY-RUN');
  });

  test('executes command step and returns exit code', async () => {
    const result = await handleStepCommand(
      {
        stepId: 's2',
        command: 'bun',
        args: ['--version'],
      },
      null
    );
    expect(result.status).toBe('SUCCEEDED');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('1.3.14');
  });
});
