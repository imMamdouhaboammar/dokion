import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("atomic commit and review policy contract", () => {
  test("publishes contributor and commit policies", async () => {
    const [contributing, policy] = await Promise.all([
      read("CONTRIBUTING.md"),
      read("docs/engineering/commit-policy.md")
    ]);

    expect(contributing).toContain("docs/engineering/commit-policy.md");
    expect(policy).toContain("One backlog item, one main-branch commit");
  });

  test("requires a reviewable behavior and verification boundary", async () => {
    const policy = await read("docs/engineering/commit-policy.md");

    for (const marker of [
      "one reviewable behavior",
      "targeted failing test",
      "full phase gate",
      "rollback boundary",
      "unrelated formatting",
      "Artificial commit splitting"
    ]) {
      expect(policy).toContain(marker);
    }
  });

  test("defines merge and exception rules", async () => {
    const policy = await read("docs/engineering/commit-policy.md");

    expect(policy).toContain("Squash merge");
    expect(policy).toContain("temporary RED history");
    expect(policy).toContain("Ordering exceptions");
    expect(policy).toContain("docs/progress/production-backlog-progress.md");
  });
});
