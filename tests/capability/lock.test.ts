import { describe, test, expect } from 'bun:test';
import { createEmptyCapabilityLock } from '../../src/capability/lock';
import { resolveCapabilityExecutable } from '../../src/capability/resolver';

describe('CAP-001 Capability Lock Engine', () => {
  test('creates empty capability lock structure', () => {
    const lock = createEmptyCapabilityLock();
    expect(lock.schema_version).toBe(1);
    expect(lock.capabilities).toEqual({});
  });

  test('resolves capability executable from lock', () => {
    const lock = createEmptyCapabilityLock();
    lock.capabilities['bun'] = {
      name: 'bun',
      executablePath: '/usr/local/bin/bun',
      digest: 'sha256-mock',
      sourceType: 'system',
    };
    const resolved = resolveCapabilityExecutable(lock, 'bun');
    expect(resolved).toBeDefined();
    expect(resolved?.executablePath).toBe('/usr/local/bin/bun');
  });
});
