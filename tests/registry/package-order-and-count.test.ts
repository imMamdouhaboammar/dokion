import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";
import { REGISTRY_PACKAGE_LIMITS } from "../../src/registry/package-limits.ts";
import { readRegistryPackageTar } from "../../src/registry/package-tar.ts";

const roots: string[] = [];
const BLOCK_SIZE = 512;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-package-order-count-"));
  roots.push(root);
  return root;
}

async function writeText(root: string, path: string, content: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function createSource(
  root: string,
  files: readonly string[],
  capabilities: readonly string[]
): Promise<string> {
  await mkdir(root, { recursive: true });
  await writeText(root, "dokion-package.json", JSON.stringify({
    schema: "dokion.package-build.v1",
    package: {
      namespace: "determinism-lab",
      name: "ordering-fixture",
      version: "1.0.0"
    },
    compatibility: { minimum_dokion_version: "0.3.0" },
    declared_capabilities: capabilities,
    files
  }));
  await writeText(root, "playbook.json", "{}\n");
  await writeText(root, "README.md", "# Ordering Fixture\n");
  await writeText(root, "LICENSE", "MIT\n");
  await writeText(root, "assets/alpha.txt", "alpha\n");
  await writeText(root, "assets/zeta.txt", "zeta\n");
  return root;
}

function writeString(block: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > length) throw new Error(`Tar field overflow: ${value}`);
  block.set(bytes, offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  writeString(block, offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
}

function emptyFileHeader(path: string): Uint8Array {
  const block = new Uint8Array(BLOCK_SIZE);
  writeString(block, 0, 100, path);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, 0);
  writeOctal(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  writeString(block, 156, 1, "0");
  writeString(block, 257, 6, "ustar\0");
  writeString(block, 263, 2, "00");
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  writeString(block, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

function excessiveFileCountArchive(): Uint8Array {
  const count = REGISTRY_PACKAGE_LIMITS.maximumFiles + 1;
  const archive = new Uint8Array(count * BLOCK_SIZE + BLOCK_SIZE * 2);
  for (let index = 0; index < count; index += 1) {
    const path = `dokion-package/file-${String(index).padStart(5, "0")}.txt`;
    archive.set(emptyFileHeader(path), index * BLOCK_SIZE);
  }
  return archive;
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package ordering and count bounds", () => {
  test("declaration and capability ordering do not change archive bytes", async () => {
    const root = await temporaryRoot();
    const firstSource = await createSource(
      join(root, "first-source"),
      ["assets/zeta.txt", "assets/alpha.txt"],
      ["semgrep", "gitleaks"]
    );
    const secondSource = await createSource(
      join(root, "second-source"),
      ["assets/alpha.txt", "assets/zeta.txt"],
      ["gitleaks", "semgrep"]
    );
    const firstOutput = join(root, "first.tar");
    const secondOutput = join(root, "second.tar");

    const first = await buildRegistryPackage({ sourceDirectory: firstSource, outputPath: firstOutput });
    const second = await buildRegistryPackage({ sourceDirectory: secondSource, outputPath: secondOutput });

    expect(await readFile(firstOutput)).toEqual(await readFile(secondOutput));
    expect(first.artifactDigest).toBe(second.artifactDigest);
    expect(first.manifest.files.map((file) => file.path)).toEqual(second.manifest.files.map((file) => file.path));
    expect(first.manifest.declared_capabilities).toEqual(["gitleaks", "semgrep"]);
  });

  test("rejects an archive entry count above the configured bound", () => {
    try {
      readRegistryPackageTar(excessiveFileCountArchive());
      throw new Error("Expected REGISTRY_PACKAGE_TOO_MANY_FILES");
    } catch (error) {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe("REGISTRY_PACKAGE_TOO_MANY_FILES");
      expect((error as DokionError).details.maximum).toBe(REGISTRY_PACKAGE_LIMITS.maximumFiles);
    }
  });
});
