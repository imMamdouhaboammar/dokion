import { describe, expect, test } from "bun:test";
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
    const memory = memories[0]!;
    expect(memory.source).toBe("github-pr");
    expect(memory.title).toContain("PR #42: Fix authentication flow");
    expect(memory.content).toContain("Always verify JWT signatures");
    expect(memory.category).toBe("general");
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
    const memory = memories[0]!;
    expect(memory.source).toBe("github-issue");
    expect(memory.title).toContain("Issue #108: Memory leak during file upload");
    expect(memory.content).toContain("Always dispose stream buffers");
  });
});
