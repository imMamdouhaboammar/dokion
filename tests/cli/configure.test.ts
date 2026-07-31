import { describe, test, expect } from "bun:test";
import { handleConfigureCommand } from "../../src/cli/handlers/configure.ts";

describe("CLI Configure Command", () => {
  test("handles configure command cleanly on active playbook", async () => {
    const root = process.cwd();
    const result = await handleConfigureCommand(root);

    expect(result.configured).toBe(true);
    expect(result.path).toContain(".dokion/playbook.json");
    expect(result.version).toBeDefined();
    expect(result.stagesCount).toBeGreaterThan(0);
    expect(result.message).toContain("Configured active playbook");
  });
});
