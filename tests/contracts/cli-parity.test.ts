import { expect, test } from "bun:test";

const registryPath = `${process.cwd()}/src/cli/command-registry.ts`;

test("a canonical CLI parity registry exists", async () => {
  expect(await Bun.file(registryPath).exists()).toBe(true);
});
