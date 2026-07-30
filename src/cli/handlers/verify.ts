import { verifyConfiguredGates, type VerifyGateOptions, type VerifyRunResult } from '../../verification/verify-run';
import type { DokionState } from '../../state/types';

export async function handleVerifyCommand(
  options: VerifyGateOptions,
  state: DokionState | null
): Promise<VerifyRunResult> {
  return await verifyConfiguredGates(options, state);
}
