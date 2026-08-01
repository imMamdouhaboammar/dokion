import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleHubCommand } from "../../src/cli/handlers/hub.ts";
import { handlePlaybooksCommand } from "../../src/cli/handlers/playbooks.ts";
import { DokionForkMergeEngine } from "../../src/registry/fork-merge.ts";
import { DokionCommunityHub } from "../../src/registry/hub.ts";
import { DokionLeaderboardEngine } from "../../src/registry/leaderboard.ts";
import type { HubPlaybookPackage } from "../../src/registry/types.ts";

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "dokion-registry-truth-"));
  roots.push(root);
  return root;
}

function syntheticPackage(): HubPlaybookPackage {
  return {
    id: "publisher/sample",
    name: "sample",
    version: "1.0.0",
    description: "unverified fixture",
    category: "general",
    tags: [],
    publisher: {
      handle: "publisher",
      name: "Publisher",
      verified: true,
      trustScore: 100
    },
    digest: `sha256:${"1".repeat(64)}`,
    playbookUrl: "https://example.invalid/playbook.json",
    stats: {
      downloads: 1000,
      activeInstalls: 500,
      rating: 5,
      ratingsCount: 100,
      successRate: 100
    },
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z"
  };
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

  test("direct leaderboard imports cannot calculate rankings from unsupported metrics", () => {
    const engine = new DokionLeaderboardEngine();

    expect(() => engine.calculateScore(syntheticPackage())).toThrow(
      expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" })
    );
    expect(() => engine.getLeaderboard([syntheticPackage()])).toThrow(
      expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" })
    );
  });

  test("direct fork and merge imports cannot synthesize or mutate Playbooks", () => {
    const root = temporaryRoot();
    const engine = new DokionForkMergeEngine(root);
    const proposalPath = join(root, "proposal.json");
    const activePath = join(root, "active.json");
    const originalActive = JSON.stringify({ project: { name: "active" } });
    writeFileSync(activePath, originalActive, "utf8");

    expect(() => engine.forkPlaybook(syntheticPackage(), "developer", proposalPath)).toThrow(
      expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" })
    );
    expect(existsSync(proposalPath)).toBe(false);

    expect(() => engine.mergePlaybookUpdates(activePath, syntheticPackage())).toThrow(
      expect.objectContaining({ code: "REGISTRY_NOT_IMPLEMENTED" })
    );
    expect(readFileSync(activePath, "utf8")).toBe(originalActive);
  });

  test("playbooks sync returns failure until lockfile synchronization exists", async () => {
    const exitCode = await handlePlaybooksCommand(["sync"], temporaryRoot());
    expect(exitCode).toBe(1);
  });
});
