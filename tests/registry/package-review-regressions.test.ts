import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import { canonicalJsonBytes, sha256Digest } from "../../src/registry/digests.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";
import { normalizePackagePath } from "../../src/registry/package-paths.ts";
import { createDeterministicPackageTar } from "../../src/registry/package-tar.ts";
import { verifyRegistryPackage } from "../../src/registry/package-verifier.ts";

const roots: string[] = [];
const BLOCK_SIZE = 512;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-package-review-"));
  roots.push(root);
  return root;
}

async function writeText(root: string, path: string, content: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function createSource(root: string): Promise<string> {
  await mkdir(root, { recursive: true });
  await writeText(root, "dokion-package.json", JSON.stringify({
    schema: "dokion.package-build.v1",
    package: {
      namespace: "review-lab",
      name: "review-fixture",
      version: "1.0.0"
    },
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: []
  }));
  await writeText(root, "playbook.json", "{}\n");
  await writeText(root, "README.md", "# Review Fixture\n");
  await writeText(root, "LICENSE", "MIT\n");
  return root;
}

function manifestFor(files: readonly { path: string; bytes: Uint8Array }[]): Record<string, unknown> {
  return {
    schema: "dokion.package-manifest.v1",
    package: {
      namespace: "review-lab",
      name: "review-fixture",
      version: "1.0.0"
    },
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
  };
}

function validArchive(extra: readonly { path: string; bytes: Uint8Array }[] = []): Uint8Array {
  const files = [
    { path: "LICENSE", bytes: Buffer.from("MIT\n") },
    { path: "README.md", bytes: Buffer.from("# Review Fixture\n") },
    { path: "playbook.json", bytes: Buffer.from("{}\n") },
    ...extra
  ];
  const manifestBytes = canonicalJsonBytes(manifestFor(files));
  return createDeterministicPackageTar([...files, { path: "manifest.json", bytes: manifestBytes }]);
}

function readOctal(bytes: Uint8Array, offset: number, length: number): number {
  const text = Buffer.from(bytes.slice(offset, offset + length)).toString("ascii").replace(/\0.*$/, "").trim();
  return Number.parseInt(text, 8);
}

function writeString(bytes: Uint8Array, offset: number, length: number, value: string): void {
  bytes.fill(0, offset, offset + length);
  bytes.set(Buffer.from(value, "ascii"), offset);
}

function writeOctal(bytes: Uint8Array, offset: number, length: number, value: number): void {
  writeString(bytes, offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
}

function rewriteChecksum(bytes: Uint8Array, headerOffset: number): void {
  bytes.fill(0x20, headerOffset + 148, headerOffset + 156);
  let checksum = 0;
  for (let index = headerOffset; index < headerOffset + BLOCK_SIZE; index += 1) checksum += bytes[index]!;
  writeString(bytes, headerOffset + 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
}

function mutateFirstHeaderMode(archive: Uint8Array): Uint8Array {
  const mutated = Uint8Array.from(archive);
  writeOctal(mutated, 100, 8, 0o600);
  rewriteChecksum(mutated, 0);
  return mutated;
}

function reorderFirstTwoEntries(archive: Uint8Array): Uint8Array {
  const firstSize = readOctal(archive, 124, 12);
  const firstLength = BLOCK_SIZE + Math.ceil(firstSize / BLOCK_SIZE) * BLOCK_SIZE;
  const secondSize = readOctal(archive, firstLength + 124, 12);
  const secondLength = BLOCK_SIZE + Math.ceil(secondSize / BLOCK_SIZE) * BLOCK_SIZE;
  const output = new Uint8Array(archive.length);
  output.set(archive.slice(firstLength, firstLength + secondLength), 0);
  output.set(archive.slice(0, firstLength), secondLength);
  output.set(archive.slice(firstLength + secondLength), firstLength + secondLength);
  return output;
}

async function expectCode(action: Promise<unknown>, code: DokionErrorCode): Promise<DokionError> {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package review regressions", () => {
  test("verifier rejects lifecycle scripts in externally produced packages", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "lifecycle.tar");
    await writeFile(
      archivePath,
      validArchive([
        {
          path: "package.json",
          bytes: Buffer.from(JSON.stringify({ scripts: { postinstall: "node exploit.js" } }))
        }
      ])
    );

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_LIFECYCLE_SCRIPT"
    );
  });

  test("verifier fails closed for a malformed externally produced package.json", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "malformed-package-json.tar");
    await writeFile(
      archivePath,
      validArchive([{ path: "package.json", bytes: Buffer.from("{not-json") }])
    );

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_MANIFEST_INVALID"
    );
  });

  test("verifier rejects noncanonical deterministic USTAR metadata", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "mode.tar");
    await writeFile(archivePath, mutateFirstHeaderMode(validArchive()));

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_ARCHIVE_INVALID"
    );
  });

  test("verifier rejects noncanonical archive entry ordering", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "order.tar");
    await writeFile(archivePath, reorderFirstTwoEntries(validArchive()));

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_ARCHIVE_INVALID"
    );
  });

  test("package paths are guaranteed representable by deterministic USTAR", () => {
    const longRepresentable = `${"a".repeat(100)}/${"b".repeat(39)}/${"c".repeat(99)}`;
    expect(Buffer.byteLength(longRepresentable, "utf8")).toBe(240);
    expect(normalizePackagePath(longRepresentable)).toBe(longRepresentable);

    expect(() => normalizePackagePath(`dir/${"x".repeat(101)}`)).toThrow(DokionError);
    expect(() => normalizePackagePath(`${"x".repeat(101)}/file.txt`)).toThrow(DokionError);

    const oldGenericBoundButUnrepresentable = `${"a".repeat(100)}/${"b".repeat(100)}/${"c".repeat(38)}`;
    expect(Buffer.byteLength(oldGenericBoundButUnrepresentable, "utf8")).toBe(240);
    expect(() => normalizePackagePath(oldGenericBoundButUnrepresentable)).toThrow(DokionError);
  });

  test("missing archives report the actual missing-path cause", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "missing.tar");
    const error = await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_ARCHIVE_INVALID"
    );
    expect(error.message).toBe("Package archive does not exist.");
    expect(error.details.errorCode).toBe("ENOENT");
  });

  if (process.platform !== "win32") {
    test("inaccessible archives report the permission cause", async () => {
      const root = await temporaryRoot();
      const archivePath = join(root, "inaccessible.tar");
      await writeFile(archivePath, validArchive());
      await chmod(archivePath, 0o000);

      const error = await expectCode(
        verifyRegistryPackage({ archivePath }),
        "REGISTRY_PACKAGE_ARCHIVE_INVALID"
      );
      expect(error.message).toContain("filesystem permissions");
      expect(["EACCES", "EPERM"]).toContain(error.details.errorCode);
    });
  }

  test("symlink rejection cannot pass by validating invalid target contents", async () => {
    const root = await temporaryRoot();
    const source = await createSource(join(root, "source"));
    const target = join(root, "valid-target.tar");
    const archivePath = join(root, "symlink.tar");
    await buildRegistryPackage({ sourceDirectory: source, outputPath: target });
    await symlink(target, archivePath, "file");

    const error = await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_ARCHIVE_INVALID"
    );
    expect(error.message).toBe("Package archive must not be a symbolic link.");
    expect(error.details.errorCode).toBe("ELOOP");
  });

  test("failed no-overwrite publication leaves no temporary artifact", async () => {
    const root = await temporaryRoot();
    const source = await createSource(join(root, "source"));
    const outputDirectory = join(root, "dist");
    const outputPath = join(outputDirectory, "package.tar");
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(outputPath, "existing", "utf8");

    await expectCode(
      buildRegistryPackage({ sourceDirectory: source, outputPath }),
      "REGISTRY_PACKAGE_OUTPUT_EXISTS"
    );

    expect(await readFile(outputPath, "utf8")).toBe("existing");
    expect((await readdir(outputDirectory)).filter((name) => name.includes(".dokion-tmp-"))).toEqual([]);
  });
});
