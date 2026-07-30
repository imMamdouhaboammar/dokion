import { describe, test, expect } from 'bun:test';
import { handlePlaybookListCommand, handlePlaybookInspectCommand } from '../../src/cli/handlers/playbook';

describe('PLAY-003 Playbook CLI Commands', () => {
  test('lists available playbooks via CLI handler', () => {
    const list = handlePlaybookListCommand();
    expect(list.length).toBeGreaterThan(0);
  });

  test('inspects specific playbook via CLI handler', () => {
    const pb = handlePlaybookInspectCommand('web-fullstack');
    expect('id' in pb).toBe(true);
    if ('id' in pb) {
      expect(pb.id).toBe('web-fullstack');
    }
  });

  test('returns error for unknown playbook ID', () => {
    const result = handlePlaybookInspectCommand('unknown-id');
    expect('error' in result).toBe(true);
  });
});
