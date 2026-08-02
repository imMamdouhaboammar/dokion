import { describe, expect, test } from "bun:test";

import { CLI_COMMAND_REGISTRY } from "../../src/cli/command-registry.ts";
import { parseCliInvocation } from "../../src/cli/parser.ts";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("Registry command and documentation quarantine", () => {
  test("marks the canonical Hub command as planned rather than implemented", () => {
    const descriptor = CLI_COMMAND_REGISTRY.find((command) => command.id === "hub");

    expect(descriptor).toBeDefined();
    expect(descriptor?.status).toBe("PLANNED");
    expect(descriptor?.purpose).toContain("unavailable");
    expect(descriptor?.purpose).toContain("#47");
    expect(descriptor?.writeScope).toEqual([]);
    expect(() => parseCliInvocation(["hub"])).toThrow(
      expect.objectContaining({ code: "CLI_PLANNED_COMMAND" })
    );
  });

  test("keeps shipped Hub adapters explicitly unavailable", async () => {
    expect(await Bun.file(`${root}/commands/dokion/hub.toml`).exists()).toBe(false);

    const adapters = await Promise.all([
      read(".agents/skills/dokion-playbook-hub/SKILL.md"),
      read(".claude/skills/dokion-playbook-hub/SKILL.md"),
      read("skills/dokion-playbook-hub/SKILL.md")
    ]);

    for (const adapter of adapters) {
      expect(adapter).toContain("unavailable");
      expect(adapter).toContain("#47");
      expect(adapter).not.toContain("pull verified playbooks");
      expect(adapter).not.toContain("Community Leaderboard");
      expect(adapter).not.toContain("GitHub Native Decentralized Community Playbook Hub");
    }
  });

  test("removes the planned Hub command from the static executable manifest", async () => {
    const manifest = await read("dokion.json");

    expect(manifest).not.toContain('"command": "dokion hub"');
    expect(manifest).not.toContain("pull verified playbooks");
    expect(manifest).not.toContain("Community Leaderboard");
    expect(manifest).not.toContain("GitHub Native Decentralized Community Playbook Hub");
  });

  test("README describes the Registry as protocol work in progress", async () => {
    const readme = await read("README.md");

    for (const claim of [
      "Verified Community",
      "verified community playbooks",
      "Peer-reviewed, benchmarked, and community-audited repository"
    ]) {
      expect(readme).not.toContain(claim);
    }

    expect(readme).toContain("Federated Playbook Registry: protocol work in progress");
    expect(readme).toContain("issues/47");
    expect(readme).toContain("built-in runtime and user-authored Playbooks");
  });
});
