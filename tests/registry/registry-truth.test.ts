import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleHubCommand } from "../../src/cli/handlers/hub.ts";
import { handlePlaybooksCommand } from "../../src/cli/handlers/playbooks.ts";
import { DokionCommunityHub } from "../../src/registry/hub.ts";

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "dokion-registry-truth-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Registry truth boundary", () => {
  test("an unconfigured Hub exposes no synthetic catalog", () => {
    const hub = new DokionCommunityHub(temporaryRoot());
    expect(hub.getCatalog()).toEqual([]);
  });

  test("pull fails closed until a transport verifies publisher bytes", async () => {
    const root = temporaryRoot();
    const proposal = join(root, ".dokion", "playbook.proposed.json");
    const hub = new DokionCommunityHub(root);

    await expect(hub.pullPackage("dokion/web-fullstack")).rejects.toMatchObject({
      code: "REGISTRY_SOURCE_REQUIRED"
    });
    expect(existsSync(proposal)).toBe(false);
  });

  test("publish fails closed instead of adding an in-memory package", () => {
    const root = temporaryRoot();
    const playbookPath = join(root, "playbook.json");
    writeFileSync(playbookPath, "{}", "utf8");
    const hub = new DokionCommunityHub(root);

    expect(() =>
      hub.publishPlaybook(playbookPath, "publisher", {
        name: "sample",
        category: "general",
        description: "sample",
        tags: []
      })
    ).toThrow(expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" }));
  });

  test("leaderboard fails closed while no metrics contract exists", async () => {
    await expect(
      handleHubCommand(temporaryRoot(), { action: "leaderboard", format: "json" })
    ).rejects.toMatchObject({ code: "REGISTRY_NOT_IMPLEMENTED" });
  });

  test("playbooks sync returns failure until lockfile synchronization exists", async () => {
    const exitCode = await handlePlaybooksCommand(["sync"], temporaryRoot());
    expect(exitCode).toBe(1);
  });
});
