import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import {
  collectDeclaredIgnoredFiles,
  type IgnoredFileExclusionReason
} from "../../src/validation/ignored-file-policy.ts";

const roots: string[] = [];

function git(root: string, ...args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe"
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
}

async function repository(ignoreRules: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-ignored-files-"));
  roots.push(root);
  git(root, "init", "-q");
  await writeFile(join(root, ".gitignore"), ignoreRules);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function exclusionReasons(
  excluded: readonly { reason: IgnoredFileExclusionReason }[]
): IgnoredFileExclusionReason[] {
  return excluded.map((item) => item.reason).sort();
}

describe("EXEC-007 bounded ignored-file policy", () => {
  test("collects only explicitly declared files that Git proves are ignored", async () => {
    const root = await repository("ignored/*.log\nother/*.log\n");
    await mkdir(join(root, "ignored"));
    await mkdir(join(root, "other"));
    await writeFile(join(root, "ignored", "b.log"), "bbbb");
    await writeFile(join(root, "ignored", "a.log"), "aa");
    await writeFile(join(root, "ignored", "keep.txt"), "tracked candidate");
    await writeFile(join(root, "other", "outside.log"), "outside");

    const collection = await collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["ignored"],
      maxFiles: 10,
      maxTotalBytes: 100
    });

    expect(collection.files.map((file) => file.path)).toEqual([
      "ignored/a.log",
      "ignored/b.log"
    ]);
    expect(collection.fileCount).toBe(2);
    expect(collection.totalBytes).toBe(6);
    expect(collection.excluded).toContainEqual({
      path: "ignored/keep.txt",
      reason: "NOT_IGNORED"
    });
  });

  test("excludes dependency trees caches credentials and generated bulk paths", async () => {
    const root = await repository("node_modules/\n.cache/\ndist/\n.env\n");
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, ".cache"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "node_modules", "pkg", "index.js"), "module");
    await writeFile(join(root, ".cache", "item"), "cache");
    await writeFile(join(root, "dist", "bundle.js"), "bundle");
    await writeFile(join(root, ".env"), "TOKEN=secret");

    const collection = await collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["node_modules", ".cache", "dist", ".env"],
      maxFiles: 10,
      maxTotalBytes: 1000
    });

    expect(collection.files).toEqual([]);
    expect(exclusionReasons(collection.excluded)).toEqual([
      "BLOCKED_CACHE",
      "BLOCKED_CREDENTIAL",
      "BLOCKED_DEPENDENCY_TREE",
      "BLOCKED_GENERATED_BULK"
    ]);
  });

  test("deduplicates overlapping declarations deterministically", async () => {
    const root = await repository("ignored/\n");
    await mkdir(join(root, "ignored"));
    await writeFile(join(root, "ignored", "a.txt"), "a");

    const collection = await collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["ignored/a.txt", "ignored"],
      maxFiles: 5,
      maxTotalBytes: 10
    });

    expect(collection.files.map((file) => file.path)).toEqual(["ignored/a.txt"]);
    expect(collection.fileCount).toBe(1);
  });

  test("blocks before returning a partial collection when file count is exceeded", async () => {
    const root = await repository("data/\n");
    await mkdir(join(root, "data"));
    await writeFile(join(root, "data", "a.txt"), "a");
    await writeFile(join(root, "data", "b.txt"), "b");

    await expect(collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["data"],
      maxFiles: 1,
      maxTotalBytes: 100
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: { reason: "FILE_COUNT_LIMIT" }
    });
  });

  test("blocks on per-file and total-byte limits", async () => {
    const root = await repository("data/\n");
    await mkdir(join(root, "data"));
    await writeFile(join(root, "data", "large.bin"), "123456");

    await expect(collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["data"],
      maxFiles: 5,
      maxTotalBytes: 100,
      maxFileBytes: 5
    })).rejects.toMatchObject({ details: { reason: "FILE_BYTES_LIMIT" } });

    await expect(collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["data"],
      maxFiles: 5,
      maxTotalBytes: 5,
      maxFileBytes: 10
    })).rejects.toMatchObject({ details: { reason: "TOTAL_BYTES_LIMIT" } });
  });

  test("rejects unsafe declarations and symlink escapes", async () => {
    const root = await repository("escape\n");
    const outside = await mkdtemp(join(tmpdir(), "dokion-ignored-outside-"));
    roots.push(outside);
    await writeFile(join(outside, "secret.txt"), "secret");
    await symlink(outside, join(root, "escape"));

    await expect(collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["../outside"],
      maxFiles: 5,
      maxTotalBytes: 100
    })).rejects.toBeInstanceOf(DokionError);

    await expect(collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["escape"],
      maxFiles: 5,
      maxTotalBytes: 100
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: { reason: "SYMLINK_ESCAPE" }
    });
  });

  test("records missing declarations without widening the scan", async () => {
    const root = await repository("missing/\n");
    const collection = await collectDeclaredIgnoredFiles(root, {
      declaredPaths: ["missing"],
      maxFiles: 5,
      maxTotalBytes: 100
    });

    expect(collection.files).toEqual([]);
    expect(collection.excluded).toEqual([{ path: "missing", reason: "MISSING" }]);
  });
});
