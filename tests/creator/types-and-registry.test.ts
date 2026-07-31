import { expect, test, describe } from "bun:test";
import { MemoryDriverRegistry } from "../../src/creator/drivers/index.js";

describe("Extended Memory Driver Registry", () => {
  test("registers new advanced memory drivers", () => {
    const registry = new MemoryDriverRegistry();
    expect(registry.get("vector-db")).toBeDefined();
    expect(registry.get("knowledge-graph")).toBeDefined();
    expect(registry.get("adr")).toBeDefined();
    expect(registry.get("github-pr")).toBeDefined();
  });
});
