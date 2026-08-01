import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-package-path-safety-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package builder source path safety", () => {
  test("rejects an intermediate directory symlink before reading a declared file", async () => {
    const root = await temporaryRoot();
    const source = join(root, "source");
    const outside = join(root, "outside");
    await mkdir(source, { recursive: true });
    await mkdir(outside, { recursive: true });

    await writeFile(join(source, "dokion-package.json"), JSON.stringify({
      schema: "dokion.package-build.v1",
      package: {
        namespace: "security-lab",
        name: "symlink-fixture",
        version: "1.0.0"
      },
      compatibility: { minimum_dokion_version: "0.3.0" },
      files: ["guides/usage.md"]
    }), "utf8");
    await writeFile(join(source, "playbook.json"), "{}\n", "utf8");
    await writeFile(join(source, "README.md"), "# Fixture\n", "utf8");
    await writeFile(join(source, "LICENSE"), "MIT\n", "utf8");
    await writeFile(join(outside, "usage.md"), "outside source bytes\n", "utf8");
    await symlink(outside, join(source, "guides"), "dir");

    try {
      await buildRegistryPackage({ sourceDirectory: source, outputPath: join(root, "package.tar") });
      throw new Error("Expected REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED");
    } catch (error) {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe("REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED");
    }
  });
});
