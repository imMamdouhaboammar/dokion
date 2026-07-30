import { describe, test, expect } from 'bun:test';
import { handleDoctorCommand } from '../../src/cli/handlers/doctor';

describe('CAP-008 Capability Audit in Doctor', () => {
  test('returns healthy report with checks', () => {
    const report = handleDoctorCommand();
    expect(report.healthy).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
