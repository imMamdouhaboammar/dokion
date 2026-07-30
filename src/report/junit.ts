export interface TestEvidenceItem {
  name: string;
  passed: boolean;
  timeSeconds?: number;
  failureMessage?: string;
}

export function exportJUnitReport(testItems: TestEvidenceItem[]): string {
  const total = testItems.length;
  const failures = testItems.filter((t) => !t.passed).length;

  const testcasesXml = testItems
    .map((t) => {
      const timeAttr = t.timeSeconds !== undefined ? ` time="${t.timeSeconds}"` : '';
      if (t.passed) {
        return `    <testcase name="${escapeXml(t.name)}"${timeAttr}/>`;
      } else {
        const msg = escapeXml(t.failureMessage ?? 'Test failed');
        return `    <testcase name="${escapeXml(t.name)}"${timeAttr}>\n      <failure message="${msg}"/>\n    </testcase>`;
      }
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="DokionVerification" tests="${total}" failures="${failures}">\n${testcasesXml}\n</testsuite>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
