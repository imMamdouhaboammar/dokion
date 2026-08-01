import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalJson } from "../../src/registry/package/canonical-json.ts";
import { buildPlaybookPackage } from "../../src/registry/package/package-builder.ts";
import { verifyPlaybookPackage } from "../../src/registry/package/package-verifier.ts";

const temporaryRoots: string[] = [];
const repositoryRoot = process.cwd();

async function temporaryDirectory(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function writePackageSource(root: string): Promise<void> {
  await mkdir(join(root, "files"), { recursive: true });
  await writeFile(
    join(root, "playbook.json"),
    JSON.stringify({
      schema_version: "1.0",
      metadata: { id: "secure-web-app", name: "Secure Web App", version: "1.2.3" },
      authority: {
        installation: "USER",
        selection: "USER",
        substitution: "USER",
        ordering: "USER",
        permissions: "USER"
      },
      capabilities: [],
      stages: []
    }, null, 2) + "\n"
  );
  await writeFile(join(root, "README.md"), "# Secure Web App\n");
  await writeFile(join(root, "LICENSE"), "MIT\n");
  await writeFile(join(root, "files", "policy.txt"), "deny unsafe writes\n");
}

const metadata = {
  namespace: "dokion-labs",
  name: "secure-web-app",
  version: "1.2.3",
  description: "A bounded web application hardening Playbook.",
  minimumDokionVersion: "0.3.0",
  platforms: ["darwin-arm64", "linux-x64"] as const,
  declaredCapabilities: ["semgrep", "gitleaks"]
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("canonical package JSON", () => {
  test("sorts object keys recursively while preserving array order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [{ z: 4, a: 5 }, 6] })).toBe(
      '{"a":{"b":3,"y":2},"list":[{"a":5,"z":4},6],"z":1}\n'
    );
  });

  test("rejects undefined and non-finite numbers rather than silently changing bytes", () => {
    expect(() => canonicalJson({ value: undefined })).toThrow();
    expect(() => canonicalJson({ value: Number.NaN })).toThrow();
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow();
  });
});

describe("deterministic Playbook package builder", () => {
  test("produces byte-identical USTAR archives despite source metadata changes", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);

    const first = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });

    await chmod(join(source, "README.md"), 0o600);
    await utimes(join(source, "README.md"), new Date("2030-01-01T00:00:00Z"), new Date("2030-01-01T00:00:00Z"));
    const second = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });

    expect(second.artifactDigest).toBe(first.artifactDigest);
    expect(second.manifestDigest).toBe(first.manifestDigest);
    expect(second.artifactBytes).toEqual(first.artifactBytes);
    expect(first.inspection.entries.map((entry) => entry.path)).toEqual([
      "manifest.json",
      "LICENSE",
      "README.md",
      "files/policy.txt",
      "playbook.json"
    ]);
    for (const entry of first.inspection.entries) {
      expect(entry.mode).toBe(0o644);
      expect(entry.uid).toBe(0);
      expect(entry.gid).toBe(0);
      expect(entry.mtime).toBe(0);
      expect(entry.type).toBe("file");
    }
  });

  test("independently verifies every payload byte and manifest claim", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);
    const built = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });

    const verified = await verifyPlaybookPackage(repositoryRoot, built.artifactBytes);

    expect(verified.artifactDigest).toBe(built.artifactDigest);
    expect(verified.manifestDigest).toBe(built.manifestDigest);
    expect(verified.manifest.package).toEqual({
      namespace: metadata.namespace,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description
    });
    expect(verified.files.map((file) => file.path)).toEqual([
      "LICENSE",
      "README.md",
      "files/policy.txt",
      "playbook.json"
    ]);
    expect(verified.authority).toEqual({
      selection_authority: false,
      substitution_authority: false,
      installation_authority: false,
      activation_authority: false,
      execution_authority: false
    });
  });

  test("changes manifest and artifact evidence when one payload byte changes", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);
    const first = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });

    await writeFile(join(source, "files", "policy.txt"), "deny unsafe writes!\n");
    const second = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });

    expect(second.manifestDigest).not.toBe(first.manifestDigest);
    expect(second.artifactDigest).not.toBe(first.artifactDigest);
    expect(second.manifest.files.find((file) => file.path === "files/policy.txt")?.digest).not.toBe(
      first.manifest.files.find((file) => file.path === "files/policy.txt")?.digest
    );
  });

  test("rejects symlinks without following them", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);
    await symlink(join(source, "README.md"), join(source, "files", "linked-readme.md"));

    await expect(buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata })).rejects.toMatchObject({
      code: "PACKAGE_SOURCE_INVALID"
    });
  });

  test("rejects a source-provided manifest to preserve one generated root manifest", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);
    await writeFile(join(source, "manifest.json"), "{}\n");

    await expect(buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata })).rejects.toMatchObject({
      code: "PACKAGE_SOURCE_INVALID"
    });
  });

  test("detects payload tampering independently of the builder", async () => {
    const source = await temporaryDirectory("dokion-package-source-");
    await writePackageSource(source);
    const built = await buildPlaybookPackage({ repositoryRoot, sourceDirectory: source, metadata });
    const tampered = new Uint8Array(built.artifactBytes);
    const policyEntry = built.inspection.entries.find((entry) => entry.path === "files/policy.txt");
    expect(policyEntry).toBeDefined();
    tampered[policyEntry!.dataOffset] = tampered[policyEntry!.dataOffset]! ^ 0xff;

    await expect(verifyPlaybookPackage(repositoryRoot, tampered)).rejects.toMatchObject({
      code: "PACKAGE_INTEGRITY_MISMATCH"
    });
  });
});
