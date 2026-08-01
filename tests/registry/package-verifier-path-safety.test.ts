import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { canonicalJsonBytes, sha256Digest } from "../../src/registry/digests.ts";
import { createDeterministicPackageTar } from "../../src/registry/package-tar.ts";
import { verifyRegistryPackage } from "../../src/registry/package-verifier.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-verifier-path-safety-"));
  roots.push(root);
  return root;
}

function validArchive(): Uint8Array {
  const files = [
    { path: "LICENSE", bytes: Buffer.from("MIT\n") },
    { path: "README.md", bytes: Buffer.from("# Valid archive\n") },
    { path: "playbook.json", bytes: Buffer.from("{}\n") }
  ];
  const manifest = canonicalJsonBytes({
    schema: "dokion.package-manifest.v1",
    package: { namespace: "path-safety", name: "valid-target", version: "1.0.0" },
    package_format: "dokion-package-tar-v1",
    playbook_path: "playbook.json",
    readme_path: "README.md",
    license_path: "LICENSE",
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: files.map((file) => ({
      path: file.path,
      kind: "file",
      media_type: file.path.endsWith(".json") ? "application/json" : "text/plain",
      size: file.bytes.length,
      digest: sha256Digest(file.bytes)
    })),
    authority: {
      selection_authority: false,
      substitution_authority: false,
      installation_authority: false,
      activation_authority: false,
      execution_authority: false
    }
  });
  return createDeterministicPackageTar([...files, { path: "manifest.json", bytes: manifest }]);
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package verifier archive path safety", () => {
  test("rejects a symlinked valid archive without following it", async () => {
    const root = await temporaryRoot();
    const target = join(root, "valid-target.tar");
    const archive = join(root, "package.tar");
    await writeFile(target, validArchive());
    await symlink(target, archive, "file");

    try {
      await verifyRegistryPackage({ archivePath: archive });
      throw new Error("Expected REGISTRY_PACKAGE_ARCHIVE_INVALID");
    } catch (error) {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe("REGISTRY_PACKAGE_ARCHIVE_INVALID");
      expect((error as DokionError).message).toBe("Package archive must not be a symbolic link.");
      expect((error as DokionError).details.errorCode).toBe("ELOOP");
    }
  });
});
