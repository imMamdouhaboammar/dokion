import { describe, test, expect } from 'bun:test';
import { selectNextAction } from '../../src/autopilot/next-action';
import type { DokionState } from '../../src/state/types';

function createMockState(status: DokionState['run']['status'], succeededSteps: string[] = []): DokionState {
  return {
    schema_version: 1,
    revision: 1,
    run: {
      id: 'run-123',
      started_at: new Date().toISOString(),
      status,
    },
    repository_identity: {
      schema_version: 1,
      kind: 'git',
      canonical_root: '/repo/root',
      root_digest: 'digest-root',
      worktree_id: 'wt-123',
      commit: '1234567890abcdef',
      remote: 'git@github.com:imMamdouhaboammar/dokion.git',
      playbook_digest: 'sha256-mock',
      captured_at: new Date().toISOString(),
    },
    playbook: {
      path: '.dokion/playbook.json',
      digest: 'sha256-mock',
      verified_at: new Date().toISOString(),
    },
    stages: [
      {
        id: 'stage-1',
        status: 'IN_PROGRESS',
        steps: succeededSteps.map((id) => ({
          id,
          status: 'SUCCEEDED',
        })),
      },
    ],
  };
}

describe('CORE-001 Next Action Selector', () => {
  test('returns NO_ACTIVE_PLAYBOOK when playbook is missing or empty', () => {
    const result = selectNextAction(null, null);
    expect(result.status).toBe('STOP_REASON');
    expect(result.stopReason).toBe('NO_ACTIVE_PLAYBOOK');
  });

  test('selects first action when state is null', () => {
    const playbook = {
      id: 'test-pb',
      name: 'Test Playbook',
      steps: [
        { id: 's1', command: 'bun test' },
        { id: 's2', command: 'bun run typecheck' },
      ],
    };
    const result = selectNextAction(null, playbook);
    expect(result.status).toBe('ACTION_SELECTED');
    expect(result.action?.stepId).toBe('s1');
  });

  test('returns PLAYBOOK_COMPLETED when state status is COMPLETED', () => {
    const state = createMockState('COMPLETED');
    const playbook = {
      id: 'test-pb',
      name: 'Test Playbook',
      steps: [{ id: 's1', command: 'bun test' }],
    };
    const result = selectNextAction(state, playbook);
    expect(result.status).toBe('STOP_REASON');
    expect(result.stopReason).toBe('PLAYBOOK_COMPLETED');
  });

  test('selects next pending step in order', () => {
    const state = createMockState('RUNNING', ['s1']);
    const playbook = {
      id: 'test-pb',
      name: 'Test Playbook',
      steps: [
        { id: 's1', command: 'bun test' },
        { id: 's2', command: 'bun run typecheck' },
      ],
    };
    const result = selectNextAction(state, playbook);
    expect(result.status).toBe('ACTION_SELECTED');
    expect(result.action?.stepId).toBe('s2');
  });

  test('returns DEPENDENCY_BLOCKED if prior dependency is not in completed step IDs', () => {
    const state = createMockState('RUNNING', []);
    const playbook = {
      id: 'test-pb',
      name: 'Test Playbook',
      steps: [
        { id: 's2', command: 'bun run typecheck', dependsOn: ['s1'] },
      ],
    };
    const result = selectNextAction(state, playbook);
    expect(result.status).toBe('STOP_REASON');
    expect(result.stopReason).toBe('DEPENDENCY_BLOCKED');
  });
});
