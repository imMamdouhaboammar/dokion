import { runAutopilot, type AutopilotOptions, type AutopilotRunResult } from '../../autopilot/run-autopilot';

export async function handleAutopilotCommand(options: AutopilotOptions): Promise<AutopilotRunResult> {
  return await runAutopilot(options);
}
