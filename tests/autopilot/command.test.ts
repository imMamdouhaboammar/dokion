import { describe, test, expect } from 'bun:test';
import { handleAutopilotCommand } from '../../src/cli/handlers/autopilot';

describe('CORE-006 Autopilot Command Handler', () => {
  test('stops when no playbook is provided', async () => {
    const result = await handleAutopilotCommand({
      playbook: { id: '', name: '', steps: [] },
      state: null,
    });
    expect(result.completed).toBe(false);
    expect(result.message).toContain('No active playbook');
  });

  test('runs dry-run mode without mutating state', async () => {
    const playbook = {
      id: 'pb-1',
      name: 'Playbook 1',
      steps: [{ id: 's1', command: 'bun test' }],
    };
    const result = await handleAutopilotCommand({
      playbook,
      state: null,
      dryRun: true,
    });
    expect(result.completed).toBe(false);
    expect(result.message).toContain('Dry-run mode');
    expect(result.lastAction?.action?.stepId).toBe('s1');
  });
});
