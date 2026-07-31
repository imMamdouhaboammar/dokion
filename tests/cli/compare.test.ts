import { describe, test, expect } from "bun:test";
import { handleCompareCommand } from "../../src/cli/handlers/compare.ts";

describe("CLI Compare Command", () => {
  test("compares runs cleanly without mutating state", async () => {
    const root = process.cwd();
    const result = await handleCompareCommand(root, { baselineRunId: "run-001", targetRunId: "run-002" });

    expect(result.baselineRunId).toBe("run-001");
    expect(result.targetRunId).toBe("run-002");
    expect(result.isReadOnly).toBe(true);
  });
});
