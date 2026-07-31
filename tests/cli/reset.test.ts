import { describe, test, expect } from "bun:test";
import { handleResetCommand } from "../../src/cli/handlers/reset.ts";

describe("CLI Reset Command", () => {
  test("resets execution state cleanly to STOPPED status", async () => {
    const root = process.cwd();
    const result = await handleResetCommand(root);

    expect(result.reset).toBe(true);
    expect(result.statePath).toBe(".dokion/state.json");
    expect(result.status).toBe("STOPPED");
    expect(result.message).toContain("reset cleanly");
  });
});
