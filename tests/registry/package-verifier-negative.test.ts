import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPlaybookPackage } from "../../src/registry/package/package-builder.ts";
import { verifyPlaybookPackage } from "../../src/registry/package/package-verifier.ts";

const roots: string[] = [];
const repositoryRoot = process.cwd();
const encoder = new TextEncoder();

async function sourceDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-malicious-package-"));
  roots.push(root);
  await mkdir(join(root, "files"), { recursive: true });
  await writeFile(
    join(root, "playbook.json"),
    JSON.stringify({
      schema_version: "1.0",
      metadata: { id: "secure-web-app", name: "Secure Web App", version: "1.2.3", owner: "dokion-labs" },
      authority: {
        installation: "USER",
        selection: "USER",
        substitution: "USER",
        ordering: "USER",
        permissions: "USER"
      },
      capabilities: [
        {
          id: "builtin.audit",
          type: "tool",
          source: "builtin",
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      ],
      stages: [{ id: "audit" }]
    }) + "\n"
  );
  await writeFile(join(root, "README.md"), "# Secure Web App\n");
  await writeFile(join(root, "LICENSE"), "MIT\n");
  await writeFile(join(root, "files", "policy.txt"), "deny unsafe writes\n");
  return root;
}

const metadata = {
  namespace: "dokion-labs",
  name: "secure-web-app",
  version: "1.2.3",
  minimumDokionVersion: "0.3.0"
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function rewriteChecksum(archive: Uint8Array, headerOffset: number): void {
  const header = archive.subarray(headerOffset, headerOffset + 512);
  header.fill(32, 148, 156);
  let checksum = 0;
  for (const value of header) checksum += value;
  const encoded = encoder.encode(checksum.toString(8).padStart(6, "0"));
  header.set(encoded, 148);
  header[154] = 0;
  header[155] = 32;
}

function rewriteName(archive: Uint8Array, headerOffset: number, path: string): void {
  const header = archive.subarray(headerOffset, headerOffset + 512);
  header.fill(0, 0, 100);
  header.fill(0, 345, 500);
  header.set(encoder.encode(path), 0);
  rewriteChecksum(archive, headerOffset);
}

async function builtPackage() {
  const source = await sourceDirectory();
  return buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });
}

describe("bounded package verifier", () => {
  test("rejects an invalid header checksum", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    archive[0] = archive[0]! ^ 0x01;

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test.each([
    ["2", "symbolic link"],
    ["1", "hard link"],
    ["3", "character device"],
    ["6", "FIFO"]
  ])("rejects a %s USTAR entry", async (typeFlag) => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    const entry = built.inspection.entries.find((candidate) => candidate.path === "README.md")!;
    archive[entry.headerOffset + 156] = typeFlag.charCodeAt(0);
    rewriteChecksum(archive, entry.headerOffset);

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects path traversal before reading the entry payload", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    const entry = built.inspection.entries.find((candidate) => candidate.path === "README.md")!;
    rewriteName(archive, entry.headerOffset, "../bad.md");

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects absolute paths", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    const entry = built.inspection.entries.find((candidate) => candidate.path === "README.md")!;
    rewriteName(archive, entry.headerOffset, "/bad.md");

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects duplicate paths", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    const policy = built.inspection.entries.find((candidate) => candidate.path === "files/policy.txt")!;
    rewriteName(archive, policy.headerOffset, "README.md");

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects a package whose first entry is not manifest.json", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    const manifest = built.inspection.entries[0]!;
    rewriteName(archive, manifest.headerOffset, "metadata.json");

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects a truncated archive", async () => {
    const built = await builtPackage();
    const archive = built.artifactBytes.slice(0, built.artifactBytes.byteLength - 512);

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects non-zero data inside the termination blocks", async () => {
    const built = await builtPackage();
    const archive = new Uint8Array(built.artifactBytes);
    archive[archive.byteLength - 1] = 1;

    await expect(verifyPlaybookPackage(repositoryRoot, archive)).rejects.toMatchObject({
      code: "PACKAGE_ARCHIVE_INVALID"
    });
  });

  test("rejects an external artifact digest mismatch before parsing", async () => {
    const built = await builtPackage();

    await expect(
      verifyPlaybookPackage(repositoryRoot, built.artifactBytes, {
        expectedArtifactDigest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      })
    ).rejects.toMatchObject({ code: "PACKAGE_INTEGRITY_MISMATCH" });
  });

  test("rejects an external manifest digest mismatch", async () => {
    const built = await builtPackage();

    await expect(
      verifyPlaybookPackage(repositoryRoot, built.artifactBytes, {
        expectedManifestDigest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      })
    ).rejects.toMatchObject({ code: "PACKAGE_INTEGRITY_MISMATCH" });
  });
});
