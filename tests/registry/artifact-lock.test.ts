import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  cleanupStaleRegistryArtifactTemps,
  registryArtifactTemporaryDirectory
} from "../../src/registry/artifact-lock.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-artifact-lock-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry artifact temporary cleanup", () => {
  test("removes only stale Dokion temporary files", async () => {
    const root = await temporaryRoot();
    const directory = registryArtifactTemporaryDirectory(root);
    await mkdir(directory, { recursive: true });
    const stale = join(directory, "artifact.dokion-tmp-stale");
    const fresh = join(directory, "artifact.dokion-tmp-fresh");
    const unrelated = join(directory, "unrelated.txt");
    await writeFile(stale, "stale", "utf8");
    await writeFile(fresh, "fresh", "utf8");
    await writeFile(unrelated, "keep", "utf8");
    await utimes(stale, new Date(0), new Date(0));

    const removed = await cleanupStaleRegistryArtifactTemps(root, 1_000, 10_000);

    expect(removed).toEqual(["artifact.dokion-tmp-stale"]);
    expect((await readdir(directory)).sort()).toEqual([
      "artifact.dokion-tmp-fresh",
      "unrelated.txt"
    ]);
  });
});
