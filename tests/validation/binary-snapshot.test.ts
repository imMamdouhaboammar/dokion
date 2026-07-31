import { afterEach, describe, expect, test } from "bun:test";
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256 } from "../../src/core/digest.ts";
import {
  captureFileSnapshot
} from "../../src/validation/file-snapshot.ts";

const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-file-snapshot-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function decodedCopy(snapshot: Awaited<ReturnType<typeof captureFileSnapshot>>): Uint8Array {
  if (snapshot.kind !== "file" || snapshot.copy === null) throw new Error("snapshot has no copy");
  return new Uint8Array(Buffer.from(snapshot.copy.data, "base64"));
}

describe("EXEC-008 binary and large file snapshots", () => {
  test("captures UTF-8 text as exact bytes without lossy conversion", async () => {
    const root = await fixtureRoot();
    const path = join(root, "text.txt");
    const bytes = new TextEncoder().encode("hello 👋\n");
    await writeFile(path, bytes);

    const snapshot = await captureFileSnapshot(path, {
      maxCopyBytes: 1024,
      requireExactRollback: true
    });

    expect(snapshot).toMatchObject({
      kind: "file",
      classification: "text",
      size: bytes.byteLength,
      digest: sha256(bytes),
      exactRollback: { supported: true, reason: null }
    });
    expect(decodedCopy(snapshot)).toEqual(bytes);
  });

  test("classifies binary bytes and preserves them exactly", async () => {
    const root = await fixtureRoot();
    const path = join(root, "binary.bin");
    const bytes = new Uint8Array([0, 255, 1, 2, 128, 10]);
    await writeFile(path, bytes);

    const snapshot = await captureFileSnapshot(path, {
      maxCopyBytes: 1024,
      requireExactRollback: true
    });

    expect(snapshot.kind).toBe("file");
    if (snapshot.kind === "file") {
      expect(snapshot.classification).toBe("binary");
      expect(snapshot.copy?.digest).toBe(sha256(bytes));
    }
    expect(decodedCopy(snapshot)).toEqual(bytes);
  });

  test("detects binary bytes beyond the bounded inspection prefix", async () => {
    const root = await fixtureRoot();
    const path = join(root, "late-binary.bin");
    const bytes = new Uint8Array([65, 66, 67, 68, 69, 70, 0, 71]);
    await writeFile(path, bytes);

    const snapshot = await captureFileSnapshot(path, {
      maxCopyBytes: 64,
      maxInspectionBytes: 4,
      requireExactRollback: true
    });

    expect(snapshot).toMatchObject({
      kind: "file",
      classification: "binary",
      digest: sha256(bytes)
    });
  });

  test("records digest and metadata when a file exceeds the copy bound", async () => {
    const root = await fixtureRoot();
    const path = join(root, "large.txt");
    const bytes = new TextEncoder().encode("0123456789");
    await writeFile(path, bytes);

    const snapshot = await captureFileSnapshot(path, {
      maxCopyBytes: 4,
      requireExactRollback: false
    });

    expect(snapshot).toMatchObject({
      kind: "file",
      classification: "text",
      size: 10,
      digest: sha256(bytes),
      copy: null,
      exactRollback: {
        supported: false,
        reason: "COPY_LIMIT_EXCEEDED"
      }
    });
  });

  test("blocks before mutation when exact rollback cannot be proven", async () => {
    const root = await fixtureRoot();
    const path = join(root, "large.bin");
    await writeFile(path, new Uint8Array(12).fill(7));

    await expect(captureFileSnapshot(path, {
      maxCopyBytes: 4,
      requireExactRollback: true
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: {
        reason: "EXACT_ROLLBACK_UNAVAILABLE",
        cause: "COPY_LIMIT_EXCEEDED"
      }
    });
  });

  test("captures missing files and symlinks without following targets", async () => {
    const root = await fixtureRoot();
    const target = join(root, "target.txt");
    const linkPath = join(root, "link.txt");
    await writeFile(target, "target");
    await symlink("target.txt", linkPath);

    const missing = await captureFileSnapshot(join(root, "missing.txt"), {
      maxCopyBytes: 64,
      requireExactRollback: true
    });
    const linked = await captureFileSnapshot(linkPath, {
      maxCopyBytes: 64,
      requireExactRollback: true
    });

    expect(missing).toMatchObject({
      kind: "missing",
      exactRollback: { supported: true, reason: null }
    });
    expect(linked).toMatchObject({
      kind: "symlink",
      target: "target.txt",
      exactRollback: { supported: true, reason: null }
    });
  });

  test("marks hard-linked files as unable to prove exact rollback", async () => {
    const root = await fixtureRoot();
    const original = join(root, "original.bin");
    const alias = join(root, "alias.bin");
    await writeFile(original, "shared");
    await link(original, alias);

    const snapshot = await captureFileSnapshot(alias, {
      maxCopyBytes: 64,
      requireExactRollback: false
    });
    expect(snapshot.exactRollback).toEqual({
      supported: false,
      reason: "HARD_LINK_UNSUPPORTED"
    });

    await expect(captureFileSnapshot(alias, {
      maxCopyBytes: 64,
      requireExactRollback: true
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: {
        reason: "EXACT_ROLLBACK_UNAVAILABLE",
        cause: "HARD_LINK_UNSUPPORTED"
      }
    });
  });

  test("rejects directories when exact rollback is required", async () => {
    const root = await fixtureRoot();
    const directory = join(root, "folder");
    await mkdir(directory);

    await expect(captureFileSnapshot(directory, {
      maxCopyBytes: 64,
      requireExactRollback: true
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: {
        reason: "EXACT_ROLLBACK_UNAVAILABLE",
        cause: "UNSUPPORTED_ENTRY"
      }
    });
  });

  test("rejects invalid copy bounds", async () => {
    const root = await fixtureRoot();
    const path = join(root, "file.txt");
    await writeFile(path, "data");

    await expect(captureFileSnapshot(path, {
      maxCopyBytes: -1,
      requireExactRollback: false
    })).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED",
      details: { reason: "INVALID_OPTIONS" }
    });
  });
});
