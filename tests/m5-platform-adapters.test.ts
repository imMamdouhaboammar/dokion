import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectAgentPlatform } from "../src/platform/platform-detector.ts";
import { StateStore } from "../src/state/state-store.ts";

const roots: string[] = [];

async function text(path: string): Promise<string> {
  return readFile(join(process.cwd(), path), "utf8");
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("M5 conservative platform detection", () => {
  test("uses DOKION_AGENT as the explicit authority and records missing guarantees", () => {
    const profile = detectAgentPlatform({
      DOKION_AGENT: "codex",
      DOKION_AGENT_VERSION: "0.99.0",
      DOKION_MODEL: "gpt-5.6-codex",
      DOKION_GUARANTEE_WORKTREE_ISOLATION: "1"
    });

    expect(profile.agent).toBe("codex");
    expect(profile.detected_by).toBe("DOKION_AGENT");
    expect(profile.version).toBe("0.99.0");
    expect(profile.model).toBe("gpt-5.6-codex");
    expect(profile.guarantees).toEqual({
      hook_enforcement: false,
      subagent_isolation: false,
      parallel_writes: false,
      worktree_isolation: true
    });
    expect(profile.degradations).toEqual([
      "NO_HOOK_ENFORCEMENT",
      "NO_SUBAGENT_ISOLATION",
      "NO_PARALLEL_WRITES"
    ]);
  });

  test("infers each supported agent only from unambiguous environment evidence", () => {
    expect(detectAgentPlatform({ CLAUDE_PROJECT_DIR: "/repo" }).agent).toBe("claude_code");
    expect(detectAgentPlatform({ CODEX_HOME: "/home/codex" }).agent).toBe("codex");
    expect(detectAgentPlatform({ GEMINI_CLI: "1" }).agent).toBe("gemini_cli");
    expect(detectAgentPlatform({ CLAUDE_PROJECT_DIR: "/repo", CODEX_HOME: "/home/codex" }).agent).toBe("other");
  });

  test("rejects invalid explicit agent values", () => {
    expect(() => detectAgentPlatform({ DOKION_AGENT: "auto" })).toThrow("Unsupported DOKION_AGENT");
  });

  test("persists platform evidence and degradations in state", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-m5-state-"));
    roots.push(root);
    await mkdir(join(root, ".dokion"), { recursive: true });
    await cp(join(process.cwd(), "schemas"), join(root, "schemas"), { recursive: true });
    const platform = detectAgentPlatform({
      DOKION_AGENT: "gemini_cli",
      DOKION_AGENT_VERSION: "0.52.0",
      DOKION_GUARANTEE_HOOK_ENFORCEMENT: "1"
    });

    const state = await new StateStore(root).initialize({
      playbookDigest: "sha256:test",
      platform,
      stages: []
    });

    expect(state.run.agent).toBe("gemini_cli");
    expect(state.run.agent_version).toBe("0.52.0");
    expect(state.run.degradations).toEqual([
      "NO_SUBAGENT_ISOLATION",
      "NO_PARALLEL_WRITES",
      "NO_WORKTREE_ISOLATION"
    ]);
    expect(state.profile?.platform).toEqual(platform);
  });
});

describe("M5 canonical skill and packaging adapters", () => {
  test("authors the Dokion hardening workflow once", async () => {
    const canonical = await text("skills/dokion-hardening/SKILL.md");
    expect(canonical.startsWith("---\n")).toBe(true);
    expect(canonical).toContain("name: dokion-hardening");
    expect(canonical).toContain("dokion validate");
    expect(canonical).toContain("dokion run");
    expect(canonical).toContain("Never select, install, substitute, reorder, or enable a capability");

    for (const wrapperPath of [".agents/skills/dokion-hardening/SKILL.md", ".claude/skills/dokion/SKILL.md"]) {
      const wrapper = await text(wrapperPath);
      expect(wrapper).toContain("CANONICAL_SKILL: skills/dokion-hardening/SKILL.md");
      expect(wrapper.split("\n").length).toBeLessThan(24);
      expect(wrapper).not.toContain("## Hardening Loop");
    }
  });

  test("ships a Claude Code plugin with a pre-tool playbook guard", async () => {
    const manifest = JSON.parse(await text(".claude-plugin/plugin.json")) as Record<string, unknown>;
    expect(manifest.name).toBe("dokion");
    expect(manifest.version).toBeUndefined();

    const hooks = JSON.parse(await text("hooks/hooks.json")) as { hooks?: { PreToolUse?: unknown[] } };
    expect(hooks.hooks?.PreToolUse?.length).toBeGreaterThan(0);
    expect(await text("scripts/claude-playbook-guard.ts")).toContain("PLAYBOOK_TAINTED");
  });

  test("ships Codex repository guidance that delegates to the canonical skill", async () => {
    const agents = await text("AGENTS.md");
    expect(agents).toContain("skills/dokion-hardening/SKILL.md");
    expect(agents).toContain(".dokion/playbook.json is the only execution authority");
    expect(agents).toContain("bun test");
  });

  test("ships a Gemini CLI extension with context and namespaced commands", async () => {
    const manifest = JSON.parse(await text("gemini-extension.json")) as Record<string, unknown>;
    expect(manifest.name).toBe("dokion");
    expect(manifest.contextFileName).toBe("GEMINI.md");
    expect(manifest.plan).toEqual({ directory: ".dokion/plans" });
    expect(await text("GEMINI.md")).toContain("skills/dokion-hardening/SKILL.md");
    expect(await text("commands/dokion/run.toml")).toContain("dokion run");
    expect(await text("commands/dokion/status.toml")).toContain("dokion status");
  });
});
