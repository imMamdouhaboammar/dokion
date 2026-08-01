import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DokionForkMergeEngine } from "../../src/registry/fork-merge.ts";
import { DokionCommunityHub } from "../../src/registry/hub.ts";
import { DokionLeaderboardEngine } from "../../src/registry/leaderboard.ts";

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

describe("Dokion Community Playbook Hub & Registry Tests", () => {
  test("initializes default catalog and searches packages by query and category", () => {
    const hub = new DokionCommunityHub(createTemporaryRoot());
    const catalog = hub.getCatalog();
    expect(catalog.length).toBeGreaterThan(0);

    const uiPackages = hub.search(undefined, "ui-ux");
    expect(uiPackages.length).toBeGreaterThan(0);
    expect(uiPackages.every((pkg) => pkg.category === "ui-ux")).toBe(true);

    const searchResults = hub.search("amElnagdy");
    expect(searchResults.length).toBe(1);
    expect(searchResults[0]!.id).toBe("amElnagdy/ui-review-loop");
  });

  test("pulls community playbook package and creates inert proposal", async () => {
    const root = createTemporaryRoot();
    const hub = new DokionCommunityHub(root);
    const targetProposalPath = join(root, "hub-test-proposal.json");

    const result = await hub.pullPackage("amElnagdy/ui-review-loop", targetProposalPath);
    expect(result.success).toBe(true);
    expect(result.package.id).toBe("amElnagdy/ui-review-loop");
    expect(existsSync(targetProposalPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(targetProposalPath, "utf-8")) as {
      project: { name: string };
    };
    expect(parsed.project.name).toBe("ui-review-loop");
  });

  test("Leaderboard Engine calculates composite scores and ranks packages", () => {
    const hub = new DokionCommunityHub(createTemporaryRoot());
    const leaderboard = new DokionLeaderboardEngine();

    const ranked = leaderboard.getLeaderboard(hub.getCatalog(), { limit: 5 });
    expect(ranked.length).toBe(5);
    const first = ranked[0]!;
    const second = ranked[1]!;
    expect(first.rank).toBe(1);
    expect(first.compositeScore).toBeGreaterThanOrEqual(second.compositeScore);
  });

  test("Fork and Merge engine clones lineage and updates active playbook", () => {
    const root = createTemporaryRoot();
    const hub = new DokionCommunityHub(root);
    const forkEngine = new DokionForkMergeEngine(root);

    const pkg = hub.getPackageById("amElnagdy/ui-review-loop");
    expect(pkg).not.toBeNull();

    const targetForkPath = join(root, "hub-test-fork.json");
    const result = forkEngine.forkPlaybook(pkg!, "test-developer", targetForkPath);
    expect(result.success).toBe(true);
    expect(result.lineage.parentPackageId).toBe("amElnagdy/ui-review-loop");
    expect(existsSync(targetForkPath)).toBe(true);
  });
});
