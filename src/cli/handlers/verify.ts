import {
  verifyDeclaredGates,
  type VerifyCommandResult
} from "../../verification/verify-run.ts";

export async function handleVerifyCommand(root: string): Promise<VerifyCommandResult> {
  return await verifyDeclaredGates(root);
}
