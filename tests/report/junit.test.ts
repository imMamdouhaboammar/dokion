import { describe, test, expect } from 'bun:test';
import { exportJUnitReport } from '../../src/report/junit';

describe('EVID-007 JUnit Test Verification Exporter', () => {
  test('exports test evidence to valid JUnit XML', () => {
    const xml = exportJUnitReport([
      { name: 'test_pass', passed: true, timeSeconds: 0.1 },
      { name: 'test_fail', passed: false, failureMessage: 'Assertion error' },
    ]);

    expect(xml).toContain('<testsuite name="DokionVerification" tests="2" failures="1">');
    expect(xml).toContain('<testcase name="test_pass" time="0.1"/>');
    expect(xml).toContain('<failure message="Assertion error"/>');
  });
});
