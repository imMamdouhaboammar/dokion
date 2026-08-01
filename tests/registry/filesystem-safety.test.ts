import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import {
  assertSafeRegularFilePath,
  ensureSafeDirectoryPath
} from "../../src/registry/filesystem-safety.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-filesystem-safety-"));
  roots.push(root);
  return root;
}

function expectCode(action: Promise<unknown>, code: string): Promise<void> {
  return action.then(
    () => { throw new Error(`Expected ${code}`); },
    (error) => {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe(code);
    }
  );
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry filesystem path safety", () => {
  test("rejects an intermediate source symlink before the final file is opened", async () => {
    const root = await temporaryRoot();
    const real = join(root, "real");
    const linked = join(root, "linked");
    await mkdir(real);
    await writeFile(join(real, "root.json"), "{}\n", "utf8");
    await symlink(real, linked, "dir");

    await expectCode(
      assertSafeRegularFilePath(join(linked, "root.json")),
      "REGISTRY_SOURCE_UNAVAILABLE"
    );
  });

  test("creates missing cache directories one component at a time without following symlinks", async () => {
    const root = await temporaryRoot();
    const real = join(root, "real-cache");
    const linked = join(root, "linked-cache");
    await mkdir(real);
    await symlink(real, linked, "dir");

    await expectCode(
      ensureSafeDirectoryPath(join(linked, "sha256", "ab")),
      "REGISTRY_CACHE_CONFLICT"
    );

    const created = join(root, "safe-cache", "sha256", "ab");
    await ensureSafeDirectoryPath(created);
    await writeFile(join(created, "sentinel"), "safe", "utf8");
  });
});
