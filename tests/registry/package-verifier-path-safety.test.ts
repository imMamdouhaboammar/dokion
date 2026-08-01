import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { verifyRegistryPackage } from "../../src/registry/package-verifier.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-verifier-path-safety-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package verifier archive path safety", () => {
  test("rejects a symlinked archive without following it", async () => {
    const root = await temporaryRoot();
    const target = join(root, "target.tar");
    const archive = join(root, "package.tar");
    await writeFile(target, new Uint8Array(1024));
    await symlink(target, archive, "file");

    try {
      await verifyRegistryPackage({ archivePath: archive });
      throw new Error("Expected REGISTRY_PACKAGE_ARCHIVE_INVALID");
    } catch (error) {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe("REGISTRY_PACKAGE_ARCHIVE_INVALID");
    }
  });
});
