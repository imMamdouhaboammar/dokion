import { describe, test, expect } from 'bun:test';
import { createEmptyCapabilityLock } from '../../src/capability/lock';
import { verifyCapabilityDigests } from '../../src/capability/verifier';

describe('CAP-004 Capability Digest Verifier', () => {
  test('passes verification when digests match', () => {
    const lock = createEmptyCapabilityLock();
    lock.capabilities['bun'] = {
      name: 'bun',
      executablePath: '/usr/local/bin/bun',
      digest: 'sha256-123',
      sourceType: 'system',
    };

    const result = verifyCapabilityDigests(lock, { bun: 'sha256-123' });
    expect(result.verified).toBe(true);
    expect(result.mismatches.length).toBe(0);
  });

  test('fails verification when digest mismatches', () => {
    const lock = createEmptyCapabilityLock();
    lock.capabilities['bun'] = {
      name: 'bun',
      executablePath: '/usr/local/bin/bun',
      digest: 'sha256-123',
      sourceType: 'system',
    };

    const result = verifyCapabilityDigests(lock, { bun: 'sha256-TAMPERED' });
    expect(result.verified).toBe(false);
    expect(result.mismatches[0]?.reason).toContain('Digest mismatch');
  });
});
