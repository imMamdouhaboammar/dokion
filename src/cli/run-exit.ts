import type { RunStatus } from "../state/types.ts";

/**
 * Returns a successful process exit only for a fully completed Dokion run
 *
 * Every other status is incomplete, blocked, failed, stale, or unsafe for
 * automation to treat as a successful engineering result
 */
export function exitCodeForRunStatus(status: RunStatus): 0 | 1 {
  return status === "COMPLETED" ? 0 : 1;
}
