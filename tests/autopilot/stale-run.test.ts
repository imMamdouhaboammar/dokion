import { describe, test, expect } from 'bun:test';
import { classifyStaleRun } from '../../src/autopilot/stale-run';
import type { DokionState } from '../../src/state/types';

function createMockState(commit: string, digest: string): DokionState {
  return {
    schema_version: 1,
    revision: 1,
    run: {
      id: 'run-1',
      started_at: new Date().toISOString(),
      status: 'RUNNING',
    },
    repository_identity: {
      schema_version: 1,
      kind: 'git',
      canonical_root: '/repo/root',
      root_digest: 'root-digest',
      worktree_id: 'wt-1',
      commit,
      playbook_digest: digest,
      captured_at: new Date().toISOString(),
    },
    playbook: {
      path: '.dokion/playbook.json',
      digest,
      verified_at: new Date().toISOString(),
    },
    stages: [],
  };
}

describe('CORE-011 Stale Run Classification', () => {
  test('returns isStale false when context matches state', () => {
    const state = createMockState('commit-123', 'sha-456');
    const result = classifyStaleRun(state, {
      currentCommit: 'commit-123',
      playbookDigest: 'sha-456',
    });
    expect(result.isStale).toBe(false);
  });

  test('detects commit drift as stale', () => {
    const state = createMockState('commit-123', 'sha-456');
    const result = classifyStaleRun(state, {
      currentCommit: 'commit-999',
      playbookDigest: 'sha-456',
    });
    expect(result.isStale).toBe(true);
    expect(result.reasons[0]).toContain('Commit SHA drift');
  });
});
