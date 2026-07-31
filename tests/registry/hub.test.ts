import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DokionCommunityHub } from "../../src/registry/hub.ts";
import { DokionLeaderboardEngine } from "../../src/registry/leaderboard.ts";
import { DokionForkMergeEngine } from "../../src/registry/fork-merge.ts";

const root = process.cwd();

describe("Dokion Community Playbook Hub & Registry Tests", () => {
  test("initializes default catalog and searches packages by query and category", () => {
    const hub = new DokionCommunityHub(root);
    const catalog = hub.getCatalog();
    expect(catalog.length).toBeGreaterThan(0);

    const uiPackages = hub.search(undefined, "ui-ux");
    expect(uiPackages.length).toBeGreaterThan(0);
    expect(uiPackages.every((p) => p.category === "ui-ux")).toBe(true);

    const searchResults = hub.search("amElnagdy");
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe("amElnagdy/ui-review-loop");
  });

  test("pulls community playbook package and creates inert proposal", async () => {
    const hub = new DokionCommunityHub(root);
    const targetProposalPath = join(root, "tests", "fixtures", "hub-test-proposal.json");

    if (existsSync(targetProposalPath)) {
      rmSync(targetProposalPath);
    }

    const res = await hub.pullPackage("amElnagdy/ui-review-loop", targetProposalPath);
    expect(res.success).toBe(true);
    expect(res.package.id).toBe("amElnagdy/ui-review-loop");
    expect(existsSync(targetProposalPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(targetProposalPath, "utf-8"));
    expect(parsed.project.name).toBe("ui-review-loop");

    if (existsSync(targetProposalPath)) {
      rmSync(targetProposalPath);
    }
  });

  test("Leaderboard Engine calculates composite scores and ranks packages", () => {
    const hub = new DokionCommunityHub(root);
    const leaderboard = new DokionLeaderboardEngine();

    const ranked = leaderboard.getLeaderboard(hub.getCatalog(), { limit: 5 });
    expect(ranked.length).toBe(5);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].compositeScore).toBeGreaterThanOrEqual(ranked[1].compositeScore);
  });

  test("Fork and Merge engine clones lineage and updates active playbook", () => {
    const hub = new DokionCommunityHub(root);
    const forkEngine = new DokionForkMergeEngine(root);

    const pkg = hub.getPackageById("amElnagdy/ui-review-loop");
    expect(pkg).not.toBeNull();

    const targetForkPath = join(root, "tests", "fixtures", "hub-test-fork.json");
    if (existsSync(targetForkPath)) rmSync(targetForkPath);

    const res = forkEngine.forkPlaybook(pkg!, "test-developer", targetForkPath);
    expect(res.success).toBe(true);
    expect(res.lineage.parentPackageId).toBe("amElnagdy/ui-review-loop");
    expect(existsSync(targetForkPath)).toBe(true);

    if (existsSync(targetForkPath)) rmSync(targetForkPath);
  });
});
