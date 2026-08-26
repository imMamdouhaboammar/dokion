import { DokionError } from "../core/errors.ts";
import type { SideEffectCheckpoint } from "../state/checkpoint.ts";

export function assertInvocationReplaySafe(checkpoint: SideEffectCheckpoint): void {
  if (checkpoint.status === "STARTED") return;
  throw new DokionError(
    "INVALID_STATE",
    `Invocation automatic replay is unsafe after side-effect checkpoint status ${checkpoint.status}`,
    {
      checkpointId: checkpoint.id,
      status: checkpoint.status
    }
  );
}
