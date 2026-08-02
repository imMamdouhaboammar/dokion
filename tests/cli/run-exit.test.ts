import { describe, expect, test } from "bun:test";

import { exitCodeForRunStatus } from "../../src/cli/run-exit.ts";
import type { RunStatus } from "../../src/state/types.ts";

describe("Dokion run process exit contract", () => {
  test("returns zero only for a completed run", () => {
    expect(exitCodeForRunStatus("COMPLETED")).toBe(0);
  });

  test("returns nonzero for every incomplete or unsafe run state", () => {
    const unsuccessful: RunStatus[] = [
      "RUNNING",
      "AWAITING_USER",
      "STOPPED",
      "BLOCKED",
      "FAILED",
      "TAINTED",
      "STALE"
    ];

    for (const status of unsuccessful) {
      expect(exitCodeForRunStatus(status)).toBe(1);
    }
  });
});
