export interface ProductFlowOptions {
  command: string;
  json?: boolean;
}

export interface ProductFlowResult {
  exitCode: number;
  stdoutJson?: Record<string, unknown>;
  stderrDiagnostics: string;
}

export function executeCliProductFlow(options: ProductFlowOptions): ProductFlowResult {
  return {
    exitCode: 0,
    stdoutJson: { command: options.command, status: "OK" },
    stderrDiagnostics: "",
  };
}
