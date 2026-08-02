import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("atomic commit and review policy contract", () => {
  test("publishes one canonical policy from contributor guidance", async () => {
    const [contributing, policy] = await Promise.all([
      read("CONTRIBUTING.md"),
      read("docs/engineering/commit-policy.md")
    ]);

    expect(contributing).toContain("docs/engineering/commit-policy.md");
    expect(contributing).toContain("Bun");
    expect(policy).toContain("## Atomic commit contract");
    expect(policy).toContain("## Review contract");
  });

  test("requires behavior evidence and a rollback boundary", async () => {
    const policy = await read("docs/engineering/commit-policy.md");

    for (const requirement of [
      "one reviewable behavior",
      "targeted failing test",
      "no unrelated formatting",
      "rollback boundary",
      "authority boundary",
      "secret boundary"
    ]) {
      expect(policy.toLowerCase()).toContain(requirement);
    }
  });

  test("rejects artificial splitting and documents verification", async () => {
    const policy = await read("docs/engineering/commit-policy.md");

    expect(policy.toLowerCase()).toContain("artificial commit splitting");
    expect(policy).toContain("bun run test");
    expect(policy).toContain("bun run typecheck");
    expect(policy).toContain("bun run validate:contracts");
    expect(policy).toContain("bun run build");
    expect(policy).toContain("Do not commit generated state");
  });
});
