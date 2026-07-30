import { describe, test, expect } from 'bun:test';
import { listBuiltInPlaybooks, getBuiltInPlaybook } from '../../src/playbook/registry';

describe('PLAY-001 Built-in Playbook Registry', () => {
  test('lists shipped built-in playbooks', () => {
    const playbooks = listBuiltInPlaybooks();
    expect(playbooks.length).toBe(3);
    expect(playbooks.map((p) => p.id)).toContain('web-fullstack');
    expect(playbooks.map((p) => p.id)).toContain('api-service');
    expect(playbooks.map((p) => p.id)).toContain('library-package');
  });

  test('retrieves specific built-in playbook by ID', () => {
    const pb = getBuiltInPlaybook('api-service');
    expect(pb).toBeDefined();
    expect(pb?.name).toContain('API Service');
  });
});
