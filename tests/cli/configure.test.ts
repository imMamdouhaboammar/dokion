import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleConfigureCommand } from "../../src/cli/handlers/configure.ts";

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-configure-"));
  temporaryRoots.push(root);
  await mkdir(join(root, "playbooks", "reference"), { recursive: true });
  await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
  await cp(
    join(process.cwd(), "playbooks", "reference", "agent-playbook.json"),
    join(root, "playbooks", "reference", "agent-playbook.json")
  );
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("CLI Configure Command", () => {
  test("handles configure command cleanly on active playbook", async () => {
    const root = await createTemporaryRoot();
    const result = await handleConfigureCommand(root);

    expect(result.configured).toBe(true);
    expect(result.path).toContain(".dokion/playbook.json");
    expect(result.version).toBeDefined();
    expect(result.stagesCount).toBeGreaterThan(0);
    expect(result.message).toContain("Configured active playbook");
  });
});
