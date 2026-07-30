export interface FindingItem {
  id: string;
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  filePath?: string;
  startLine?: number;
}

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
      };
    };
    results: Array<{
      ruleId: string;
      level: 'error' | 'warning' | 'note';
      message: { text: string };
      locations?: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region?: { startLine: number };
        };
      }>;
    }>;
  }>;
}

export function exportSarifReport(findings: FindingItem[]): SarifLog {
  const results = findings.map((f) => {
    const level = f.severity === 'error' ? 'error' : f.severity === 'warning' ? 'warning' : 'note';
    return {
      ruleId: f.ruleId,
      level: level as 'error' | 'warning' | 'note',
      message: { text: f.message },
      ...(f.filePath
        ? {
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.filePath },
                  ...(f.startLine ? { region: { startLine: f.startLine } } : {}),
                },
              },
            ],
          }
        : {}),
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Dokion',
            version: '0.3.0',
            informationUri: 'https://github.com/imMamdouhaboammar/dokion',
          },
        },
        results,
      },
    ],
  };
}
