import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionCommunityHub } from "../../src/registry/hub.ts";

const temporaryRoots: string[] = [];

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "dokion-hub-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Dokion Community Registry quarantine", () => {
  test("does not expose packages before a verified source is configured", () => {
    const hub = new DokionCommunityHub(createTemporaryRoot());

    expect(hub.getCatalog()).toEqual([]);
    expect(hub.search("web", "ui-ux")).toEqual([]);
    expect(hub.getPackageById("dokion/web-fullstack")).toBeNull();
  });

  test("does not synthesize a proposal when pull has no Registry source", async () => {
    const root = createTemporaryRoot();
    const targetProposalPath = join(root, "hub-test-proposal.json");
    const hub = new DokionCommunityHub(root);

    await expect(
      hub.pullPackage("dokion/web-fullstack", targetProposalPath)
    ).rejects.toMatchObject({ code: "REGISTRY_SOURCE_REQUIRED" });
    expect(existsSync(targetProposalPath)).toBe(false);
  });

  test("does not report local-only publishing as remote success", () => {
    const hub = new DokionCommunityHub(createTemporaryRoot());

    expect(() =>
      hub.publishPlaybook("playbook.json", "publisher", {
        name: "sample",
        category: "general",
        description: "sample",
        tags: []
      })
    ).toThrow(expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" }));
  });
});
