import { describe, expect, test } from "bun:test";

const root = process.cwd();
const publicFiles = [
  "README.md",
  "docs/getting-started/ONBOARDING.md",
  "docs/launch/MARKETING_STRATEGY.md"
];

const unsupportedClaims = [
  /multi-agent swarms/i,
  /bounded sub-agents/i,
  /automatic Git rollback/i,
  /empirical test verification/i,
  /autonomous, verified, multi-agent workflows/i
];

describe("public claim truth boundary", () => {
  test("does not publish unqualified adoption claims", async () => {
    for (const path of publicFiles) {
      const source = await Bun.file(`${root}/${path}`).text();
      for (const claim of unsupportedClaims) expect(source).not.toMatch(claim);
    }
  });

  test("describes the current verify command as contract validation", async () => {
    const readme = await Bun.file(`${root}/README.md`).text();
    expect(readme).toContain(
      "`dokion verify` currently validates repository and Playbook contracts"
    );
    expect(readme).not.toContain("Verify test/build proof (`dokion verify`)");
  });
});
