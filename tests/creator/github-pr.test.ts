import { expect, test, describe } from "bun:test";
import { GitHubPrDriver } from "../../src/creator/drivers/github-pr.js";

describe("GitHubPrDriver", () => {
  test("extracts PR review suggestions into actionable memories", async () => {
    const driver = new GitHubPrDriver();
    const memories = await driver.fetchMemories({
      customPrs: [
        {
          prNumber: 42,
          title: "Fix authentication flow",
          comments: [
            {
              author: "lead-dev",
              body: "Always verify JWT signatures using RSA-256 before granting admin access.",
            },
          ],
        },
      ],
    });

    expect(memories.length).toBe(1);
    expect(memories[0].source).toBe("github-pr");
    expect(memories[0].title).toContain("PR #42: Fix authentication flow");
    expect(memories[0].content).toContain("Always verify JWT signatures");
    expect(memories[0].category).toBe("general");
  });

  test("extracts Issue discussion recommendations into actionable memories", async () => {
    const driver = new GitHubPrDriver("github-issue");
    const memories = await driver.fetchMemories({
      customIssues: [
        {
          issueNumber: 108,
          title: "Memory leak during file upload",
          comments: [
            {
              author: "qa-lead",
              body: "Recommendation: Always dispose stream buffers immediately after write completes.",
            },
          ],
        },
      ],
    });

    expect(memories.length).toBe(1);
    expect(memories[0].source).toBe("github-issue");
    expect(memories[0].title).toContain("Issue #108: Memory leak during file upload");
    expect(memories[0].content).toContain("Always dispose stream buffers");
  });
});
