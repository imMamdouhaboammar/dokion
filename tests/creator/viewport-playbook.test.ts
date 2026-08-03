import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePlaybookData } from "../../src/contracts/schema-validator.ts";
import { PlaybookCreatorEngine } from "../../src/creator/engine.ts";

const root = process.cwd();

describe("Viewport Bugs & UI Review Playbook Tests", () => {
  test("reference playbook exists and passes JSON Schema contract validation", async () => {
    const playbookPath = join(root, "playbooks/reference/viewport-bugs-ui-review.playbook.json");
    expect(existsSync(playbookPath)).toBe(true);

    const data = JSON.parse(readFileSync(playbookPath, "utf-8"));
    const issues = await validatePlaybookData(root, data, "playbooks/reference/viewport-bugs-ui-review.playbook.json");
    expect(issues.length).toBe(0);
  });

  test("PlaybookCreatorEngine synthesizes Viewport Bug & UI Review Playbook from memories", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "dokion-viewport-playbook-"));

    try {
      const engine = new PlaybookCreatorEngine();
      const result = await engine.createPlaybook({
        topic: "Viewport Bugs & UI Review Loop",
        customMemories: [
          {
            id: "viewport-mem-1",
            source: "manual",
            timestamp: new Date().toISOString(),
            title: "Provision Agent Browser & Browser Use",
            content: 'Run `npx skills use "https://github.com/vercel-labs/agent-browser" --skill "agent-browser"` and `npx skills use "https://github.com/browser-use/browser-use" --skill "browser-use"` to scan viewports.',
            category: "ui-ux",
          },
          {
            id: "viewport-mem-2",
            source: "manual",
            timestamp: new Date().toISOString(),
            title: "Systematic Debugging of CSS Overflow",
            content: 'Run `npx skills use "https://github.com/obra/superpowers" --skill "systematic-debugging"` to trace root cause of CSS flex/grid overflow bugs.',
            category: "ui-ux",
          },
          {
            id: "viewport-mem-3",
            source: "manual",
            timestamp: new Date().toISOString(),
            title: "UI Review Loop Reporting",
            content: 'Run `npx skills add "https://github.com/amElnagdy/ui-review-loop"` and render visual before/after report to HARDENING.md and UI_REVIEW.md.',
            category: "ui-ux",
          },
        ],
        outputPath: join(tempRoot, "viewport-test-generated.json"),
      });

      expect(result.success).toBe(true);
      expect(result.extractedStepsCount).toBeGreaterThan(0);
      expect(result.playbook.project.name).toContain("viewport-bugs-ui-review-loop");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
