import { describe, test, expect } from 'bun:test';
import { handleVerifyCommand } from '../../src/cli/handlers/verify';

describe('CORE-010 Verification Gate Re-run', () => {
  test('runs dry-run verification gates cleanly', async () => {
    const result = await handleVerifyCommand({ dryRun: true }, null);
    expect(result.passed).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  });

  test('runs custom passing gate', async () => {
    const result = await handleVerifyCommand(
      {
        gates: [{ id: 'echo-gate', command: 'echo hello' }],
      },
      null
    );
    expect(result.passed).toBe(true);
    expect(result.results[0]?.passed).toBe(true);
  });
});
