import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import { canonicalJsonBytes, sha256Digest } from "../../src/registry/digests.ts";
import { buildRegistryPackage } from "../../src/registry/package-builder.ts";
import { cachePathForDigest } from "../../src/registry/artifact-cache.ts";
import { createDeterministicPackageTar, readRegistryPackageTar } from "../../src/registry/package-tar.ts";
import { pullRegistryPackage } from "../../src/registry/pull-service.ts";

const roots: string[] = [];
const authority = {
  selection_authority: false,
  substitution_authority: false,
  installation_authority: false,
  activation_authority: false,
  execution_authority: false
} as const;

interface RegistryFixture {
  root: string;
  project: string;
  registry: string;
  cache: string;
  configPath: string;
  artifactPath: string;
  artifactDigest: `sha256:${string}`;
  packageReference: string;
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-registry-pull-"));
  roots.push(root);
  return root;
}

async function writeText(root: string, path: string, content: string): Promise<void> {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

async function packageSource(root: string, identity = { namespace: "pull-lab", name: "fixture", version: "1.0.0" }): Promise<string> {
  await mkdir(root, { recursive: true });
  await writeText(root, "dokion-package.json", JSON.stringify({
    schema: "dokion.package-build.v1",
    package: identity,
    compatibility: { minimum_dokion_version: "0.3.0" },
    files: []
  }));
  await writeText(root, "playbook.json", "{}\n");
  await writeText(root, "README.md", "# Pull fixture\n");
  await writeText(root, "LICENSE", "MIT\n");
  return root;
}

async function writeRegistryDocuments(
  fixture: Omit<RegistryFixture, "artifactDigest" | "packageReference">,
  artifactBytes: Uint8Array,
  packageIdentity = { namespace: "pull-lab", name: "fixture", version: "1.0.0" },
  overrides: { artifactDigest?: string; artifactSize?: number; manifestDigest?: string; manifestSize?: number } = {}
): Promise<{ artifactDigest: `sha256:${string}`; packageReference: string }> {
  const archiveEntries = readRegistryPackageTar(artifactBytes);
  const manifestBytes = archiveEntries.find((entry) => entry.path === "manifest.json")!.bytes;
  const artifactDigest = sha256Digest(artifactBytes);
  const index = canonicalJsonBytes({
    schema: "dokion.registry-index.v1",
    source_id: "local.registry",
    generated_at: "2026-08-01T00:00:00Z",
    expires_at: "2030-08-01T00:00:00Z",
    packages: [{
      ...packageIdentity,
      source: { transport: "local", location: "artifacts/package.dokion-package" },
      manifest: {
        location: "manifests/package.json",
        digest: overrides.manifestDigest ?? sha256Digest(manifestBytes),
        size: overrides.manifestSize ?? manifestBytes.length
      },
      artifact: {
        location: "artifacts/package.dokion-package",
        digest: overrides.artifactDigest ?? artifactDigest,
        size: overrides.artifactSize ?? artifactBytes.length
      },
      published_at: "2026-08-01T00:00:00Z",
      minimum_dokion_version: "0.3.0",
      deprecation: { state: "CURRENT" },
      revocation: { state: "CLEAR" }
    }],
    authority
  });
  await writeFile(join(fixture.registry, "index.json"), index);

  const root = canonicalJsonBytes({
    schema: "dokion.registry-root.v1",
    source: {
      id: "local.registry",
      name: "local-registry",
      transport: "local",
      location: "root.json"
    },
    generated_at: "2026-08-01T00:00:00Z",
    expires_at: "2030-08-01T00:00:00Z",
    indexes: [{ location: "index.json", digest: sha256Digest(index), size: index.length }],
    authority
  });
  await writeFile(join(fixture.registry, "root.json"), root);

  return {
    artifactDigest,
    packageReference: `${packageIdentity.namespace}/${packageIdentity.name}@${packageIdentity.version}`
  };
}

async function createFixture(): Promise<RegistryFixture> {
  const root = await temporaryRoot();
  const project = join(root, "project");
  const registry = join(root, "registry");
  const cache = join(root, "cache");
  const source = await packageSource(join(root, "package-source"));
  const artifactPath = join(registry, "artifacts", "package.dokion-package");
  await mkdir(dirname(artifactPath), { recursive: true });
  await mkdir(join(registry, "manifests"), { recursive: true });
  const build = await buildRegistryPackage({ sourceDirectory: source, outputPath: artifactPath });
  const artifactBytes = await readFile(artifactPath);

  const configPath = join(project, ".dokion", "registries.json");
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, canonicalJsonBytes({
    schema: "dokion.registry-config.v1",
    scope: "project",
    revision: 1,
    sources: [{
      name: "local-registry",
      id: "local.registry",
      priority: 0,
      enabled: true,
      cache_ttl_seconds: 0,
      transport: "local",
      path: registry
    }],
    network_policy: {
      https_only: true,
      allow_private_networks: false,
      maximum_redirects: 3,
      maximum_response_bytes: 10485760
    },
    authority
  }));
  await writeFile(join(project, ".dokion", "sentinel.json"), "{\"unchanged\":true}\n", "utf8");

  const metadata = await writeRegistryDocuments(
    { root, project, registry, cache, configPath, artifactPath },
    artifactBytes
  );
  expect(metadata.artifactDigest).toBe(build.artifactDigest);
  return { root, project, registry, cache, configPath, artifactPath, ...metadata };
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

async function projectSnapshot(project: string): Promise<Record<string, string>> {
  return {
    config: await readFile(join(project, ".dokion", "registries.json"), "utf8"),
    sentinel: await readFile(join(project, ".dokion", "sentinel.json"), "utf8")
  };
}

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe("Registry pull and immutable artifact cache", () => {
  test("retrieves validated local metadata, verifies the artifact, and publishes a content-addressed cache object", async () => {
    const fixture = await createFixture();
    const before = await projectSnapshot(fixture.project);

    const evidence = await pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    });

    const expectedPath = cachePathForDigest(fixture.cache, fixture.artifactDigest);
    expect(evidence.cachePath).toBe(expectedPath);
    expect(evidence.artifactDigest).toBe(fixture.artifactDigest);
    expect(evidence.packageId).toBe("pull-lab/fixture");
    expect(evidence.version).toBe("1.0.0");
    expect(evidence.cacheHit).toBe(false);
    expect(evidence.installed).toBe(false);
    expect(evidence.activated).toBe(false);
    expect(evidence.executionAuthority).toBe(false);
    expect(await readFile(expectedPath)).toEqual(await readFile(fixture.artifactPath));
    expect((await readdir(dirname(expectedPath))).sort()).toEqual(["artifact.dokion-package", "evidence.json"]);
    expect(await projectSnapshot(fixture.project)).toEqual(before);
  });

  test("recomputes the digest and package verification on a cache hit", async () => {
    const fixture = await createFixture();
    await pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    });
    const second = await pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local.registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    });
    expect(second.cacheHit).toBe(true);
    expect(second.artifactDigest).toBe(fixture.artifactDigest);
    expect(second.packageVerification.valid).toBe(true);
  });

  test("rejects cache corruption instead of overwriting an immutable object", async () => {
    const fixture = await createFixture();
    const first = await pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    });
    await rm(first.cachePath, { force: true });
    await writeFile(first.cachePath, "corrupted", "utf8");
    await chmod(first.cachePath, 0o444);

    await expectCode(pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    }), "REGISTRY_CACHE_CORRUPT");
    expect(await readFile(first.cachePath, "utf8")).toBe("corrupted");
  });

  test("rejects source digest mismatch before final cache publication", async () => {
    const fixture = await createFixture();
    const artifactBytes = await readFile(fixture.artifactPath);
    await writeRegistryDocuments(fixture, artifactBytes, undefined, {
      artifactDigest: `sha256:${"0".repeat(64)}`
    });

    await expectCode(pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    }), "REGISTRY_ARTIFACT_DIGEST_MISMATCH");

    expect(await Bun.file(cachePathForDigest(fixture.cache, `sha256:${"0".repeat(64)}`)).exists()).toBe(false);
  });

  test("concurrent pulls of the same digest converge on one verified immutable object", async () => {
    const fixture = await createFixture();
    const results = await Promise.all(Array.from({ length: 8 }, () => pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    })));

    expect(new Set(results.map((result) => result.cachePath)).size).toBe(1);
    expect(results.filter((result) => result.cacheHit).length).toBeGreaterThanOrEqual(7);
    const objectDirectory = dirname(results[0]!.cachePath);
    expect((await readdir(objectDirectory)).sort()).toEqual(["artifact.dokion-package", "evidence.json"]);
  });

  test("rejects package identity and manifest digest substitution", async () => {
    const fixture = await createFixture();
    const artifactBytes = await readFile(fixture.artifactPath);
    await writeRegistryDocuments(fixture, artifactBytes, {
      namespace: "other-lab",
      name: "fixture",
      version: "1.0.0"
    });

    await expectCode(pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: "other-lab/fixture@1.0.0",
      cacheRoot: fixture.cache
    }), "REGISTRY_PACKAGE_ID_MISMATCH");

    await writeRegistryDocuments(fixture, artifactBytes, undefined, {
      manifestDigest: `sha256:${"f".repeat(64)}`
    });
    await expectCode(pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: join(fixture.root, "second-cache")
    }), "REGISTRY_MANIFEST_DIGEST_MISMATCH");
  });

  test("cached lifecycle scripts remain rejected and never become final cache objects", async () => {
    const fixture = await createFixture();
    const files = [
      { path: "LICENSE", bytes: Buffer.from("MIT\n") },
      { path: "README.md", bytes: Buffer.from("# External\n") },
      { path: "playbook.json", bytes: Buffer.from("{}\n") },
      { path: "package.json", bytes: Buffer.from(JSON.stringify({ scripts: { postinstall: "node exploit.js" } })) }
    ];
    const manifestBytes = canonicalJsonBytes({
      schema: "dokion.package-manifest.v1",
      package: { namespace: "pull-lab", name: "fixture", version: "1.0.0" },
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
      authority
    });
    const malicious = createDeterministicPackageTar([...files, { path: "manifest.json", bytes: manifestBytes }]);
    await writeFile(fixture.artifactPath, malicious);
    await writeRegistryDocuments(fixture, malicious);

    const error = await expectCode(pullRegistryPackage({
      configPath: fixture.configPath,
      source: "local-registry",
      packageReference: fixture.packageReference,
      cacheRoot: fixture.cache
    }), "REGISTRY_PACKAGE_LIFECYCLE_SCRIPT");
    expect(error.message.toLowerCase()).toContain("lifecycle");
    expect(await Bun.file(cachePathForDigest(fixture.cache, sha256Digest(malicious))).exists()).toBe(false);
  });

  test("different verified digests cannot occupy the same cache object", async () => {
    const first = await createFixture();
    const secondRoot = await temporaryRoot();
    const source = await packageSource(join(secondRoot, "source"), { namespace: "pull-lab", name: "fixture-two", version: "1.0.0" });
    await writeText(source, "README.md", "# Different bytes\n");
    const secondArtifact = join(secondRoot, "registry", "artifacts", "package.dokion-package");
    await mkdir(dirname(secondArtifact), { recursive: true });
    await buildRegistryPackage({ sourceDirectory: source, outputPath: secondArtifact });
    const secondDigest = sha256Digest(await readFile(secondArtifact));

    expect(cachePathForDigest(first.cache, first.artifactDigest)).not.toBe(cachePathForDigest(first.cache, secondDigest));
  });
});
