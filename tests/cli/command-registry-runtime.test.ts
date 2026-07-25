import { expect, test } from "bun:test";

const registryPath = "../../src/cli/command-registry.ts";

test("command registry exposes runtime metadata APIs", async () => {
  const registry = (await import(registryPath)) as Record<string, unknown>;

  expect(typeof registry.renderCliHelp).toBe("function");
  expect(typeof registry.resolveCliCommand).toBe("function");
  expect(typeof registry.manifestCliCommands).toBe("function");
  expect(typeof registry.geminiCommandsForFile).toBe("function");
});
