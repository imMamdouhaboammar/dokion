import { describe, test, expect } from 'bun:test';
import { exportSarifReport } from '../../src/report/sarif';

describe('EVID-006 SARIF v2.1 Exporter', () => {
  test('exports empty findings array to valid SARIF log', () => {
    const sarif = exportSarifReport([]);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.tool.driver.name).toBe('Dokion');
    expect(sarif.runs[0]?.results.length).toBe(0);
  });

  test('converts findings into SARIF results with physical locations', () => {
    const sarif = exportSarifReport([
      {
        id: 'f-1',
        ruleId: 'DK-SEC-001',
        severity: 'error',
        message: 'Hardcoded secret detected',
        filePath: 'src/config.ts',
        startLine: 12,
      },
    ]);
    expect(sarif.runs[0]?.results.length).toBe(1);
    expect(sarif.runs[0]?.results[0]?.ruleId).toBe('DK-SEC-001');
    expect(sarif.runs[0]?.results[0]?.level).toBe('error');
    expect(
      sarif.runs[0]?.results[0]?.locations?.[0]?.physicalLocation.artifactLocation.uri
    ).toBe('src/config.ts');
  });
});
