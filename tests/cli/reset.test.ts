import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleResetCommand } from "../../src/cli/handlers/reset.ts";

const temporaryRoots: string[] = [];

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "dokion-reset-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("CLI Reset Command", () => {
  test("resets execution state cleanly to STOPPED status", async () => {
    const result = await handleResetCommand(createTemporaryRoot());

    expect(result.reset).toBe(true);
    expect(result.statePath).toBe(".dokion/state.json");
    expect(result.status).toBe("STOPPED");
    expect(result.message).toContain("reset cleanly");
  });
});
