import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluatePlaybookGuard } from "../scripts/claude-playbook-guard.ts";

const roots: string[] = [];

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fixture(status = "RUNNING"): Promise<{ root: string; playbook: string }> {
  const root = await mkdtemp(join(tmpdir(), "dokion-m5-hook-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  const playbook = '{"version":"1.0.0"}\n';
  await writeFile(join(root, ".dokion", "playbook.json"), playbook);
  await writeFile(
    join(root, ".dokion", "state.json"),
    JSON.stringify({
      run: { status },
      playbook: { path: ".dokion/playbook.json", digest: digest(playbook) }
    })
  );
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
