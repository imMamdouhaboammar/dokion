import { describe, expect, test } from "bun:test";

import { handleAutoresearchCommand } from "../../src/cli/handlers/autoresearch.ts";

describe("autoresearch CLI execution boundary", () => {
  test("rejects non-dry execution until a production modifier and verifier are configured", async () => {
    await expect(handleAutoresearchCommand(process.cwd(), {
      positionals: ["autoresearch", "harden", "the", "repository"],
      options: new Map(),
      flags: new Set(),
      format: "json",
    })).rejects.toThrow("production execution callbacks");
  });
});
