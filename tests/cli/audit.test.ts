import { describe, test, expect } from 'bun:test';
import { handleAuditCommand } from '../../src/cli/handlers/audit';

describe('EVID-010 Independent Audit Command', () => {
  test('computes evidence manifest and runs audit cleanly', () => {
    const result = handleAuditCommand([
      { path: '.dokion/evidence/e1.log', content: 'Verification evidence 1' },
      { path: '.dokion/evidence/e2.log', content: 'Verification evidence 2' },
    ]);

    expect(result.audited).toBe(true);
    expect(result.manifest.entries.length).toBe(2);
    expect(result.manifest.rootDigest.startsWith('sha256:')).toBe(true);
    expect(result.message).toContain('verified 2 evidence artifacts');
  });
});
