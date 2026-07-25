import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluatePlaybookGuard } from "../scripts/claude-playbook-guard.ts";

const roots: string[] = [];

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function writeState(root: string, status: string, path: string, expected: string): Promise<void> {
  await writeFile(
    join(root, ".dokion", "state.json"),
    JSON.stringify({ run: { status }, playbook: { path, digest: expected } })
  );
}

async function fixture(status = "RUNNING"): Promise<{ root: string; playbook: string }> {
  const root = await mkdtemp(join(tmpdir(), "dokion-m5-hook-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  const playbook = '{"version":"1.0.0"}\n';
  await writeFile(join(root, ".dokion", "playbook.json"), playbook);
  await writeState(root, status, ".dokion/playbook.json", digest(playbook));
  return { root, playbook };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Claude playbook guard", () => {
  test("allows a stable playbook during an active run", async () => {
    const { root } = await fixture();
    expect(await evaluatePlaybookGuard(root)).toEqual({
      allow: true,
      expected: expect.stringMatching(/^sha256:/),
      observed: expect.stringMatching(/^sha256:/)
    });
  });

  test("blocks a changed playbook during an active run", async () => {
    const { root } = await fixture();
    await writeFile(join(root, ".dokion", "playbook.json"), '{"version":"2.0.0"}\n');

    const result = await evaluatePlaybookGuard(root);

    expect(result.allow).toBe(false);
    expect(result.reason).toContain("PLAYBOOK_TAINTED");
    expect(result.expected).not.toBe(result.observed);
  });

  test("rejects a noncanonical playbook path even when the digest matches", async () => {
    const { root, playbook } = await fixture();
    await writeFile(join(root, ".dokion", "alternate.json"), playbook);
    await writeState(root, "RUNNING", ".dokion/alternate.json", digest(playbook));

    const result = await evaluatePlaybookGuard(root);

    expect(result.allow).toBe(false);
    expect(result.reason).toContain("noncanonical playbook path");
  });

  test("rejects a symlinked active playbook", async () => {
    const { root, playbook } = await fixture();
    const target = join(root, "outside-playbook.json");
    await writeFile(target, playbook);
    await rm(join(root, ".dokion", "playbook.json"));
    await symlink(target, join(root, ".dokion", "playbook.json"));

    const result = await evaluatePlaybookGuard(root);

    expect(result.allow).toBe(false);
    expect(result.reason).toContain("regular file");
  });

  test("does not block tools after a terminal run status", async () => {
    const { root } = await fixture("COMPLETED");
    await writeFile(join(root, ".dokion", "playbook.json"), '{"version":"2.0.0"}\n');
    expect(await evaluatePlaybookGuard(root)).toEqual({ allow: true });
  });

  test("allows repositories that have not initialized Dokion", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-m5-hook-empty-"));
    roots.push(root);
    expect(await evaluatePlaybookGuard(root)).toEqual({ allow: true });
  });
});
