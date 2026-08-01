import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";
import { normalizePackagePath } from "../../src/registry/package-paths.ts";
import { verifyRegistryPackage } from "../../src/registry/package-verifier.ts";

const temporaryRoots: string[] = [];
const AUTHORITY_NONE = {
  selection_authority: false,
  substitution_authority: false,
  installation_authority: false,
  activation_authority: false,
  execution_authority: false
} as const;

interface TarEntryInput {
  path: string;
  bytes: Uint8Array;
  type?: "file" | "symlink" | "hardlink";
  linkName?: string;
}

interface ManifestFileInput {
  path: string;
  bytes: Uint8Array;
  mediaType?: string;
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-package-test-"));
  temporaryRoots.push(root);
  return root;
}

async function writeSourceFile(root: string, path: string, value: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function createSource(root: string): Promise<string> {
  const source = join(root, "source");
  await mkdir(source, { recursive: true });
  await writeSourceFile(source, "dokion-package.json", JSON.stringify({
    schema: "dokion.package-build.v1",
    package: {
      namespace: "acme-security",
      name: "secure-web-app",
      version: "1.2.3",
      description: "A deterministic test package."
    },
    compatibility: {
      minimum_dokion_version: "0.3.0",
      platforms: ["linux-x64", "darwin-arm64"]
    },
    declared_capabilities: ["semgrep", "gitleaks"],
    files: ["guides/usage.md"]
  }, null, 2));
  await writeSourceFile(source, "playbook.json", JSON.stringify({
    version: "1.0.0",
    project: { name: "Secure Web App" },
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
  }, null, 2));
  await writeSourceFile(source, "README.md", "# Secure Web App\n\nPackage fixture.\n");
  await writeSourceFile(source, "LICENSE", "MIT\n");
  await writeSourceFile(source, "guides/usage.md", "# Usage\n\nRun explicitly.\n");
  return source;
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function writeString(block: Uint8Array, offset: number, length: number, value: string): void {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.length > length) throw new Error(`Tar field too long: ${value}`);
  block.set(encoded, offset);
}

function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
  const encoded = value.toString(8).padStart(length - 1, "0") + "\0";
  writeString(block, offset, length, encoded);
}

function tarHeader(entry: TarEntryInput): Uint8Array {
  const block = new Uint8Array(512);
  writeString(block, 0, 100, entry.path);
  writeOctal(block, 100, 8, 0o644);
  writeOctal(block, 108, 8, 0);
  writeOctal(block, 116, 8, 0);
  writeOctal(block, 124, 12, entry.type === "file" || entry.type === undefined ? entry.bytes.length : 0);
  writeOctal(block, 136, 12, 0);
  block.fill(0x20, 148, 156);
  const typeFlag = entry.type === "symlink" ? "2" : entry.type === "hardlink" ? "1" : "0";
  writeString(block, 156, 1, typeFlag);
  if (entry.linkName) writeString(block, 157, 100, entry.linkName);
  writeString(block, 257, 6, "ustar\0");
  writeString(block, 263, 2, "00");
  const checksum = block.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(8).padStart(6, "0") + "\0 ";
  writeString(block, 148, 8, checksumText);
  return block;
}

function tarArchive(entries: readonly TarEntryInput[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (const entry of entries) {
    const header = tarHeader(entry);
    chunks.push(header);
    length += header.length;
    if (entry.type === "file" || entry.type === undefined) {
      chunks.push(entry.bytes);
      length += entry.bytes.length;
      const paddingLength = (512 - (entry.bytes.length % 512)) % 512;
      if (paddingLength > 0) {
        const padding = new Uint8Array(paddingLength);
        chunks.push(padding);
        length += padding.length;
      }
    }
  }
  chunks.push(new Uint8Array(1024));
  length += 1024;
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function manifest(files: readonly ManifestFileInput[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: "dokion.package-manifest.v1",
    package: {
      namespace: "acme-security",
      name: "secure-web-app",
      version: "1.2.3"
    },
    package_format: "dokion-package-tar-v1",
    playbook_path: "playbook.json",
    readme_path: "README.md",
    license_path: "LICENSE",
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: files.map((file) => ({
      path: file.path,
      kind: "file",
      media_type: file.mediaType ?? (file.path.endsWith(".json") ? "application/json" : "text/plain"),
      size: file.bytes.length,
      digest: sha256(file.bytes)
    })),
    authority: AUTHORITY_NONE,
    ...overrides
  };
}

async function writeArchive(root: string, entries: readonly TarEntryInput[], name = "fixture.dokion.tar"): Promise<string> {
  const path = join(root, name);
  await writeFile(path, tarArchive(entries));
  return path;
}

async function expectDokionError(action: Promise<unknown>, code: string): Promise<DokionError> {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

async function snapshotTree(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(directory: string, prefix = ""): Promise<void> {
    const names = (await readdir(directory)).sort();
    for (const name of names) {
      const absolute = join(directory, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      const stat = await lstat(absolute);
      if (stat.isDirectory()) await visit(absolute, relative);
      else result[relative] = createHash("sha256").update(await readFile(absolute)).digest("hex");
    }
  }
  await visit(root);
  return result;
}

afterEach(async () => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry package paths", () => {
  test("normalizes a safe relative payload path", () => {
    expect(normalizePackagePath("guides/usage.md")).toBe("guides/usage.md");
  });

  for (const unsafePath of [
    "../outside.txt",
    "/absolute.txt",
    "./dot.txt",
    "guides/../outside.txt",
    "guides\\usage.md",
    "guides/%2e%2e/outside.txt",
    "guides/%2Foutside.txt",
    "guides//usage.md"
  ]) {
    test(`rejects unsafe package path ${unsafePath}`, () => {
      expect(() => normalizePackagePath(unsafePath)).toThrow(DokionError);
    });
  }
});

describe("Registry package builder", () => {
  test("produces byte-identical archives despite source timestamp and mode changes", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const firstPath = join(root, "first.dokion.tar");
    const secondPath = join(root, "second.dokion.tar");

    const first = await buildRegistryPackage({ sourceDirectory: source, outputPath: firstPath });
    await utimes(join(source, "README.md"), new Date("2030-01-01T00:00:00Z"), new Date("2030-01-01T00:00:00Z"));
    await chmod(join(source, "README.md"), 0o600);
    const second = await buildRegistryPackage({ sourceDirectory: source, outputPath: secondPath });

    expect(await readFile(firstPath)).toEqual(await readFile(secondPath));
    expect(first.artifactDigest).toBe(second.artifactDigest);
    expect(first.packageId).toBe("acme-security/secure-web-app");
    expect(first.version).toBe("1.2.3");
    expect(JSON.stringify(first.manifest)).not.toContain("artifact_digest");
    expect(JSON.stringify(first.manifest)).not.toContain("manifest_digest");
  });

  test("changes the artifact digest when declared file bytes change", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const first = await buildRegistryPackage({ sourceDirectory: source, outputPath: join(root, "first.tar") });
    await writeSourceFile(source, "guides/usage.md", "# Usage\n\nChanged exact bytes.\n");
    const second = await buildRegistryPackage({ sourceDirectory: source, outputPath: join(root, "second.tar") });
    expect(first.artifactDigest).not.toBe(second.artifactDigest);
  });

  test("refuses to overwrite an existing output without explicit permission", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const outputPath = join(root, "package.tar");
    await writeFile(outputPath, "existing", "utf8");
    await expectDokionError(
      buildRegistryPackage({ sourceDirectory: source, outputPath }),
      "REGISTRY_PACKAGE_OUTPUT_EXISTS"
    );
    expect(await readFile(outputPath, "utf8")).toBe("existing");
  });

  test("rejects symlinked declared files", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    await rm(join(source, "guides/usage.md"));
    await symlink(join(source, "README.md"), join(source, "guides/usage.md"));
    await expectDokionError(
      buildRegistryPackage({ sourceDirectory: source, outputPath: join(root, "package.tar") }),
      "REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED"
    );
  });

  test("rejects lifecycle scripts in declared package.json files", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const configPath = join(source, "dokion-package.json");
    const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    config.files = ["package.json"];
    await writeFile(configPath, JSON.stringify(config), "utf8");
    await writeFile(join(source, "package.json"), JSON.stringify({ scripts: { postinstall: "node exploit.js" } }), "utf8");
    await expectDokionError(
      buildRegistryPackage({ sourceDirectory: source, outputPath: join(root, "package.tar") }),
      "REGISTRY_PACKAGE_LIFECYCLE_SCRIPT"
    );
  });
});

describe("Registry package verifier", () => {
  test("verifies a valid built package without installing, activating, or mutating project state", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const archivePath = join(root, "package.tar");
    await mkdir(join(root, ".dokion"), { recursive: true });
    await writeFile(join(root, ".dokion/state.json"), "{\"sentinel\":true}\n", "utf8");
    await buildRegistryPackage({ sourceDirectory: source, outputPath: archivePath });
    const before = await snapshotTree(root);

    const evidence = await verifyRegistryPackage({
      archivePath,
      expectedPackageId: "acme-security/secure-web-app",
      expectedVersion: "1.2.3"
    });

    expect(evidence.valid).toBe(true);
    expect(evidence.packageId).toBe("acme-security/secure-web-app");
    expect(evidence.version).toBe("1.2.3");
    expect(evidence.installed).toBe(false);
    expect(evidence.activated).toBe(false);
    expect(evidence.extracted).toBe(false);
    expect(evidence.files.map((file) => file.path)).toEqual([
      "LICENSE",
      "README.md",
      "guides/usage.md",
      "playbook.json"
    ]);
    expect(await snapshotTree(root)).toEqual(before);
  });

  test("rejects duplicate normalized archive paths", async () => {
    const root = await temporaryRoot();
    const bytes = Buffer.from("same", "utf8");
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/README.md", bytes },
      { path: "dokion-package/README.md", bytes }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_PATH_DUPLICATE"
    );
  });

  test("rejects case-collision archive paths", async () => {
    const root = await temporaryRoot();
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/README.md", bytes: Buffer.from("upper") },
      { path: "dokion-package/readme.md", bytes: Buffer.from("lower") }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_CASE_COLLISION"
    );
  });

  test("rejects traversal before reading package contents", async () => {
    const root = await temporaryRoot();
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/../outside.txt", bytes: Buffer.from("escape") }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_PATH_INVALID"
    );
  });

  test("rejects symlinks and hardlinks before manifest processing", async () => {
    const root = await temporaryRoot();
    for (const type of ["symlink", "hardlink"] as const) {
      const archivePath = await writeArchive(root, [
        { path: `dokion-package/${type}`, bytes: new Uint8Array(), type, linkName: "../../outside" }
      ], `${type}.tar`);
      await expectDokionError(
        verifyRegistryPackage({ archivePath }),
        "REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED"
      );
    }
  });

  test("rejects undeclared files", async () => {
    const root = await temporaryRoot();
    const playbook = Buffer.from("{}\n");
    const readme = Buffer.from("readme\n");
    const license = Buffer.from("license\n");
    const declared = [
      { path: "playbook.json", bytes: playbook },
      { path: "README.md", bytes: readme },
      { path: "LICENSE", bytes: license }
    ];
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest(declared))}\n`);
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/manifest.json", bytes: manifestBytes },
      ...declared.map((file) => ({ path: `dokion-package/${file.path}`, bytes: file.bytes })),
      { path: "dokion-package/undeclared.txt", bytes: Buffer.from("not declared") }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_UNDECLARED_FILE"
    );
  });

  test("rejects missing declared files", async () => {
    const root = await temporaryRoot();
    const declared = [
      { path: "playbook.json", bytes: Buffer.from("{}\n") },
      { path: "README.md", bytes: Buffer.from("readme\n") },
      { path: "LICENSE", bytes: Buffer.from("license\n") }
    ];
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest(declared))}\n`);
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/manifest.json", bytes: manifestBytes },
      { path: "dokion-package/playbook.json", bytes: declared[0]!.bytes },
      { path: "dokion-package/LICENSE", bytes: declared[2]!.bytes }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_DECLARED_FILE_MISSING"
    );
  });

  test("rejects changed payload bytes with an exact digest mismatch", async () => {
    const root = await temporaryRoot();
    const declared = [
      { path: "playbook.json", bytes: Buffer.from("{}\n") },
      { path: "README.md", bytes: Buffer.from("original\n") },
      { path: "LICENSE", bytes: Buffer.from("license\n") }
    ];
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest(declared))}\n`);
    const archivePath = await writeArchive(root, [
      { path: "dokion-package/manifest.json", bytes: manifestBytes },
      { path: "dokion-package/playbook.json", bytes: declared[0]!.bytes },
      { path: "dokion-package/README.md", bytes: Buffer.from("modified\n") },
      { path: "dokion-package/LICENSE", bytes: declared[2]!.bytes }
    ]);
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_DIGEST_MISMATCH"
    );
  });

  test("rejects malformed manifests and unknown authority claims", async () => {
    const root = await temporaryRoot();
    const malformed = await writeArchive(root, [
      { path: "dokion-package/manifest.json", bytes: Buffer.from("{broken") }
    ], "malformed.tar");
    await expectDokionError(
      verifyRegistryPackage({ archivePath: malformed }),
      "REGISTRY_PACKAGE_MANIFEST_INVALID"
    );

    const files = [
      { path: "playbook.json", bytes: Buffer.from("{}\n") },
      { path: "README.md", bytes: Buffer.from("readme\n") },
      { path: "LICENSE", bytes: Buffer.from("license\n") }
    ];
    const unsafeManifest = manifest(files, {
      authority: { ...AUTHORITY_NONE, execution_authority: true }
    });
    const unsafe = await writeArchive(root, [
      { path: "dokion-package/manifest.json", bytes: Buffer.from(`${JSON.stringify(unsafeManifest)}\n`) },
      ...files.map((file) => ({ path: `dokion-package/${file.path}`, bytes: file.bytes }))
    ], "authority.tar");
    await expectDokionError(
      verifyRegistryPackage({ archivePath: unsafe }),
      "REGISTRY_PACKAGE_AUTHORITY_CLAIM"
    );
  });

  test("rejects package identity and version mismatches", async () => {
    const root = await temporaryRoot();
    const source = await createSource(root);
    const archivePath = join(root, "package.tar");
    await buildRegistryPackage({ sourceDirectory: source, outputPath: archivePath });
    await expectDokionError(
      verifyRegistryPackage({ archivePath, expectedPackageId: "other/package" }),
      "REGISTRY_PACKAGE_ID_MISMATCH"
    );
    await expectDokionError(
      verifyRegistryPackage({ archivePath, expectedVersion: "9.9.9" }),
      "REGISTRY_PACKAGE_VERSION_MISMATCH"
    );
  });

  test("rejects compressed input before archive parsing", async () => {
    const root = await temporaryRoot();
    const archivePath = join(root, "compressed.tar.gz");
    await writeFile(archivePath, Uint8Array.from([0x1f, 0x8b, 0x08, 0x00]));
    await expectDokionError(
      verifyRegistryPackage({ archivePath }),
      "REGISTRY_PACKAGE_COMPRESSION_UNSUPPORTED"
    );
  });
});
