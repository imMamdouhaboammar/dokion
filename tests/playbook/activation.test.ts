import { describe, test, expect } from 'bun:test';
import { activatePlaybookContent } from '../../src/playbook/registry';

describe('PLAY-005 Playbook Activation', () => {
  test('calculates SHA-256 digest on activation', () => {
    const content = JSON.stringify({ id: 'test-pb', steps: [] });
    const result = activatePlaybookContent(content, '.dokion/playbook.json');
    expect(result.activated).toBe(true);
    expect(result.digest.startsWith('sha256:')).toBe(true);
    expect(result.digest.length).toBe(71);
    expect(result.playbookPath).toBe('.dokion/playbook.json');
  });
});
