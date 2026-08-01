import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import { canonicalJsonBytes, sha256Digest } from "../../src/registry/digests.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";
import { REGISTRY_PACKAGE_LIMITS } from "../../src/registry/package-limits.ts";
import { createDeterministicPackageTar } from "../../src/registry/package-tar.ts";
import { verifyRegistryPackage } from "../../src/registry/package-verifier.ts";

const roots: string[] = [];

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "dokion-adversarial-"));
  roots.push(value);
  return value;
}

async function writeText(base: string, path: string, content: string): Promise<void> {
  const target = join(base, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function sourceDirectory(base: string, extraFiles: string[] = []): Promise<string> {
  const source = join(base, "source");
  await mkdir(source, { recursive: true });
  await writeText(source, "dokion-package.json", JSON.stringify({
    schema: "dokion.package-build.v1",
    package: {
      namespace: "security-lab",
      name: "adversarial-fixture",
      version: "1.0.0"
    },
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: extraFiles
  }));
  await writeText(source, "playbook.json", JSON.stringify({
    version: "1.0.0",
    project: { name: "Adversarial Fixture" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY",
      automatic_capability_discovery: false,
      automatic_installation: false,
      automatic_substitution: false,
      automatic_reordering: false,
      recommendations_require_approval: true
    },
    stages: [{ id: "inspect", name: "Inspect", steps: [] }]
  }));
  await writeText(source, "README.md", "# Adversarial Fixture\n");
  await writeText(source, "LICENSE", "MIT\n");
  return source;
}

async function expectCode(action: Promise<unknown>, code: DokionErrorCode): Promise<void> {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
  }
}

function declaredFile(path: string, bytes: Uint8Array): Record<string, unknown> {
  return {
    path,
    kind: "file",
    media_type: path.endsWith(".json") ? "application/json" : "text/plain",
    size: bytes.length,
    digest: sha256Digest(bytes)
  };
}

function manifest(
  files: Array<{ path: string; bytes: Uint8Array }>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    schema: "dokion.package-manifest.v1",
    package: {
      namespace: "security-lab",
      name: "adversarial-fixture",
      version: "1.0.0"
    },
    package_format: "dokion-package-tar-v1",
    playbook_path: "playbook.json",
    readme_path: "README.md",
    license_path: "LICENSE",
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: files.map((file) => declaredFile(file.path, file.bytes)),
    authority: {
      selection_authority: false,
      substitution_authority: false,
      installation_authority: false,
      activation_authority: false,
      execution_authority: false
    },
    ...overrides
  };
}

async function forgedArchive(
  base: string,
  manifestOverrides: Record<string, unknown> = {},
  payloadOverrides: Record<string, Uint8Array> = {}
): Promise<string> {
  const payload = [
    { path: "LICENSE", bytes: Buffer.from("MIT\n") },
    { path: "README.md", bytes: Buffer.from("# Fixture\n") },
    { path: "playbook.json", bytes: Buffer.from("{}\n") }
  ].map((file) => ({ ...file, bytes: payloadOverrides[file.path] ?? file.bytes }));
  const manifestBytes = canonicalJsonBytes(manifest(payload, manifestOverrides));
  const archive = createDeterministicPackageTar([...payload, { path: "manifest.json", bytes: manifestBytes }]);
  const path = join(base, `forged-${createHash("sha256").update(archive).digest("hex").slice(0, 8)}.tar`);
  await writeFile(path, archive);
  return path;
}

function rawTar(path: string, declaredSize: number, payload = new Uint8Array()): Uint8Array {
  const block = new Uint8Array(512);
  const write = (offset: number, length: number, value: string): void => {
    const bytes = Buffer.from(value, "utf8");
    if (bytes.length > length) throw new Error("field overflow");
    block.set(bytes, offset);
  };
  const octal = (offset: number, length: number, value: number): void =>
    write(offset, length, `${value.toString(8).padStart(length - 1, "0")}\0`);

  write(0, 100, path);
  octal(100, 8, 0o644);
  octal(108, 8, 0);
  octal(116, 8, 0);
  octal(124, 12, declaredSize);
  octal(136, 12, 0);
  block.fill(0x20, 148, 156);
  write(156, 1, "0");
  write(257, 6, "ustar\0");
  write(263, 2, "00");
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  write(148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);

  const padded = Math.ceil(payload.length / 512) * 512;
  const archive = new Uint8Array(512 + padded + 1024);
  archive.set(block, 0);
  archive.set(payload, 512);
  return archive;
}

afterEach(async () => {
  while (roots.length > 0) {
    const value = roots.pop();
    if (value) await rm(value, { recursive: true, force: true });
  }
});

describe("Registry package adversarial verification", () => {
  test("rejects non-zero archive padding bytes", async () => {
    const base = await root();
    const source = await sourceDirectory(base);
    const archivePath = join(base, "package.tar");
    await buildRegistryPackage({ sourceDirectory: source, outputPath: archivePath });
    const bytes = Uint8Array.from(await readFile(archivePath));

    const firstFileSize = Number.parseInt(Buffer.from(bytes.slice(124, 136)).toString("ascii").replace(/\0.*$/, "").trim(), 8);
    bytes[512 + firstFileSize] = 1;
    await writeFile(archivePath, bytes);

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_ARCHIVE_INVALID"
    );
  });

  test("reports a missing declared source file as missing, not as an unsupported entry type", async () => {
    const base = await root();
    const source = await sourceDirectory(base, ["missing.txt"]);

    await expectCode(
      buildRegistryPackage({ sourceDirectory: source, outputPath: join(base, "package.tar") }),
      "REGISTRY_PACKAGE_REQUIRED_FILE_MISSING"
    );
  });

  test("rejects an unknown generic verified claim", async () => {
    const base = await root();
    const archivePath = await forgedArchive(base, { verified: true });
    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_MANIFEST_INVALID"
    );
  });

  test("rejects a mutable package version", async () => {
    const base = await root();
    const archivePath = await forgedArchive(base, {
      package: {
        namespace: "security-lab",
        name: "adversarial-fixture",
        version: "latest"
      }
    });
    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_MANIFEST_INVALID"
    );
  });

  test("rejects an exact file-size mismatch", async () => {
    const base = await root();
    const files = [
      { path: "LICENSE", bytes: Buffer.from("MIT\n") },
      { path: "README.md", bytes: Buffer.from("# Fixture\n") },
      { path: "playbook.json", bytes: Buffer.from("{}\n") }
    ];
    const value = manifest(files);
    const declarations = value.files as Array<Record<string, unknown>>;
    declarations[1] = { ...declarations[1], size: Number(declarations[1]!.size) + 1 };
    const manifestBytes = canonicalJsonBytes(value);
    const archive = createDeterministicPackageTar([...files, { path: "manifest.json", bytes: manifestBytes }]);
    const archivePath = join(base, "size-mismatch.tar");
    await writeFile(archivePath, archive);

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_SIZE_MISMATCH"
    );
  });

  test("rejects absolute and mixed-slash archive entry paths", async () => {
    const base = await root();
    for (const [name, unsafePath] of [
      ["absolute", "/dokion-package/manifest.json"],
      ["backslash", "dokion-package\\manifest.json"]
    ] as const) {
      const archivePath = join(base, `${name}.tar`);
      await writeFile(archivePath, rawTar(unsafePath, 0));
      await expectCode(
        verifyRegistryPackage({ archivePath }),
        "REGISTRY_PACKAGE_PATH_INVALID"
      );
    }
  });

  test("rejects an entry whose declared size exceeds the individual-file limit before payload access", async () => {
    const base = await root();
    const archivePath = join(base, "oversized.tar");
    await writeFile(
      archivePath,
      rawTar("dokion-package/oversized.bin", REGISTRY_PACKAGE_LIMITS.maximumFileBytes + 1)
    );

    await expectCode(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_FILE_TOO_LARGE"
    );
  });

  test("rejects credential-bearing source metadata in build configuration", async () => {
    const base = await root();
    const source = await sourceDirectory(base);
    const configPath = join(source, "dokion-package.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.source = "https://user:token@example.com/registry.git";
    await writeFile(configPath, JSON.stringify(config), "utf8");

    await expectCode(
      buildRegistryPackage({ sourceDirectory: source, outputPath: join(base, "package.tar") }),
      "REGISTRY_PACKAGE_CONFIG_INVALID"
    );
  });
});
