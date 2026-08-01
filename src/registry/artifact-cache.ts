import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, unlink } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { DokionError } from "../core/errors.ts";
import { canonicalJsonBytes, sha256Digest } from "./digests.ts";
import {
  cleanupStaleRegistryArtifactTemps,
  registryArtifactTemporaryDirectory,
  withRegistryArtifactLock
} from "./artifact-lock.ts";
import { readVerifiedLocalBytes } from "./artifact-fetcher.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";
import { readRegistryPackageTar } from "./package-tar.ts";
import {
  verifyRegistryPackage,
  type RegistryPackageVerificationEvidence
} from "./package-verifier.ts";
import {
  createRegistryPullEvidence,
  registryPullEvidenceBytes,
  type RegistryPullCacheEvidence
} from "./pull-evidence.ts";
import type { RegistrySourceEvidence } from "./source-client.ts";

const UNSUPPORTED_DIRECTORY_SYNC_CODES = new Set(["EBADF", "EINVAL", "EISDIR", "ENOTSUP"]);

export interface CacheRegistryArtifactOptions {
  cacheRoot: string;
  bytes: Uint8Array;
  expectedArtifactDigest: `sha256:${string}`;
  expectedArtifactSize: number;
  expectedManifestDigest: `sha256:${string}`;
  expectedManifestSize: number;
  expectedPackageId: string;
  expectedVersion: string;
  source: RegistrySourceEvidence;
  indexDigest: `sha256:${string}`;
  indexSize: number;
}

export interface CachedRegistryArtifact {
  cachePath: string;
  evidencePath: string;
  cacheHit: boolean;
  packageVerification: RegistryPackageVerificationEvidence;
  evidence: RegistryPullCacheEvidence;
}

interface VerifiedArtifactCandidate {
  verification: RegistryPackageVerificationEvidence;
  manifestSize: number;
}

function digestHex(digest: `sha256:${string}`): string {
  const hex = digest.slice("sha256:".length);
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new DokionError("REGISTRY_CACHE_CONFLICT", "Registry cache digest is invalid.", { digest });
  }
  return hex;
}

function objectDirectory(cacheRoot: string, digest: `sha256:${string}`): string {
  const hex = digestHex(digest);
  return join(resolve(cacheRoot), "sha256", hex.slice(0, 2), hex.slice(2));
}

export function cachePathForDigest(cacheRoot: string, digest: `sha256:${string}`): string {
  return join(objectDirectory(cacheRoot, digest), "artifact.dokion-package");
}

export function cacheEvidencePathForDigest(cacheRoot: string, digest: `sha256:${string}`): string {
  return join(objectDirectory(cacheRoot, digest), "evidence.json");
}

function cacheObjectReference(cacheRoot: string, digest: `sha256:${string}`): string {
  const path = relative(resolve(cacheRoot), objectDirectory(cacheRoot, digest));
  if (path === "" || path === ".." || path.startsWith(`..${sep}`)) {
    throw new DokionError("REGISTRY_CACHE_CONFLICT", "Registry cache object escaped the configured cache root.");
  }
  return path.split(sep).join("/");
}

async function pathState(path: string): Promise<"missing" | "file"> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache path must be a single-link regular file.", {
      path,
      links: stat.nlink
    });
  }
  if ((stat.mode & 0o222) !== 0) {
    throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache object must be read-only.", {
      path,
      mode: stat.mode & 0o777
    });
  }
  return "file";
}

async function writeSyncedExclusive(path: string, bytes: Uint8Array): Promise<void> {
  let handle;
  try {
    handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function syncDirectory(path: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && UNSUPPORTED_DIRECTORY_SYNC_CODES.has(code)) return;
    throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function verifyCandidate(
  path: string,
  expected: Pick<
    CacheRegistryArtifactOptions,
    | "expectedArtifactDigest"
    | "expectedArtifactSize"
    | "expectedManifestDigest"
    | "expectedManifestSize"
    | "expectedPackageId"
    | "expectedVersion"
  >
): Promise<VerifiedArtifactCandidate> {
  const bytes = await readVerifiedLocalBytes({
    path,
    maximumBytes: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes,
    expectedDigest: expected.expectedArtifactDigest,
    expectedSize: expected.expectedArtifactSize,
    digestMismatchCode: "REGISTRY_ARTIFACT_DIGEST_MISMATCH",
    sizeMismatchCode: "REGISTRY_ARTIFACT_SIZE_MISMATCH"
  });
  const entries = readRegistryPackageTar(bytes.bytes);
  const manifests = entries.filter((entry) => entry.path === "manifest.json");
  if (manifests.length !== 1) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Cached package must contain exactly one manifest.json.", {
      count: manifests.length
    });
  }
  const manifest = manifests[0]!;
  if (manifest.bytes.length !== expected.expectedManifestSize) {
    throw new DokionError("REGISTRY_MANIFEST_SIZE_MISMATCH", "Package manifest size does not match Registry Index metadata.", {
      expectedSize: expected.expectedManifestSize,
      observedSize: manifest.bytes.length
    });
  }
  const manifestDigest = sha256Digest(manifest.bytes);
  if (manifestDigest !== expected.expectedManifestDigest) {
    throw new DokionError("REGISTRY_MANIFEST_DIGEST_MISMATCH", "Package manifest digest does not match Registry Index metadata.", {
      expectedDigest: expected.expectedManifestDigest,
      observedDigest: manifestDigest
    });
  }
  const verification = await verifyRegistryPackage({
    archivePath: path,
    expectedPackageId: expected.expectedPackageId,
    expectedVersion: expected.expectedVersion
  });
  return { verification, manifestSize: manifest.bytes.length };
}

function expectedEvidence(
  options: CacheRegistryArtifactOptions,
  verification: RegistryPackageVerificationEvidence
): RegistryPullCacheEvidence {
  const evidence = createRegistryPullEvidence({
    source: options.source,
    indexDigest: options.indexDigest,
    indexSize: options.indexSize,
    packageId: options.expectedPackageId,
    version: options.expectedVersion,
    artifactDigest: options.expectedArtifactDigest,
    artifactSize: options.expectedArtifactSize,
    manifestDigest: options.expectedManifestDigest,
    manifestSize: options.expectedManifestSize,
    verification
  });
  const serialized = JSON.stringify(evidence);
  if (/authorization|cookie|token|password|signed[_-]?url/i.test(serialized)) {
    throw new DokionError("REGISTRY_CACHE_CONFLICT", "Registry cache evidence contains a forbidden sensitive field.");
  }
  return evidence;
}

async function readEvidence(path: string, expected: RegistryPullCacheEvidence): Promise<void> {
  const result = await readVerifiedLocalBytes({
    path,
    maximumBytes: 1024 * 1024
  });
  const canonical = registryPullEvidenceBytes(expected);
  if (!Buffer.from(result.bytes).equals(Buffer.from(canonical))) {
    throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache evidence does not match the verified artifact.", {
      evidencePath: path
    });
  }
}

async function verifyExisting(
  options: CacheRegistryArtifactOptions,
  artifactPath: string,
  evidencePath: string
): Promise<CachedRegistryArtifact> {
  try {
    const artifactState = await pathState(artifactPath);
    const evidenceState = await pathState(evidencePath);
    if (artifactState !== "file" || evidenceState !== "file") {
      throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache entry is partial and cannot be used.", {
        artifactState,
        evidenceState
      });
    }
    const candidate = await verifyCandidate(artifactPath, options);
    const evidence = expectedEvidence(options, candidate.verification);
    await readEvidence(evidencePath, evidence);
    return {
      cachePath: artifactPath,
      evidencePath,
      cacheHit: true,
      packageVerification: candidate.verification,
      evidence
    };
  } catch (error) {
    if (error instanceof DokionError && error.code === "REGISTRY_CACHE_CORRUPT") throw error;
    throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache entry failed immutable verification.", {
      cachePath: artifactPath,
      causeCode: error instanceof DokionError ? error.code : "UNKNOWN",
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function unlinkIfPresent(path: string): Promise<void> {
  await unlink(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}

export async function cacheRegistryArtifact(
  options: CacheRegistryArtifactOptions
): Promise<CachedRegistryArtifact> {
  if (options.bytes.length !== options.expectedArtifactSize) {
    throw new DokionError("REGISTRY_ARTIFACT_SIZE_MISMATCH", "Retrieved artifact size does not match Registry Index metadata.", {
      expectedSize: options.expectedArtifactSize,
      observedSize: options.bytes.length
    });
  }
  const observedDigest = sha256Digest(options.bytes);
  if (observedDigest !== options.expectedArtifactDigest) {
    throw new DokionError("REGISTRY_ARTIFACT_DIGEST_MISMATCH", "Retrieved artifact digest does not match Registry Index metadata.", {
      expectedDigest: options.expectedArtifactDigest,
      observedDigest
    });
  }

  const artifactPath = cachePathForDigest(options.cacheRoot, options.expectedArtifactDigest);
  const evidencePath = cacheEvidencePathForDigest(options.cacheRoot, options.expectedArtifactDigest);
  const directory = dirname(artifactPath);
  const temporaryDirectory = registryArtifactTemporaryDirectory(options.cacheRoot);
  const identifier = `${digestHex(options.expectedArtifactDigest)}.dokion-tmp-${process.pid}-${randomUUID()}`;
  const temporaryArtifactPath = join(temporaryDirectory, `${identifier}.artifact`);
  const temporaryEvidencePath = join(temporaryDirectory, `${identifier}.evidence`);

  return withRegistryArtifactLock(options.cacheRoot, options.expectedArtifactDigest, async () => {
    await cleanupStaleRegistryArtifactTemps(options.cacheRoot);
    await mkdir(temporaryDirectory, { recursive: true });
    await mkdir(directory, { recursive: true });

    const artifactState = await pathState(artifactPath);
    const evidenceState = await pathState(evidencePath);
    if (artifactState === "file" || evidenceState === "file") {
      if (artifactState !== evidenceState) {
        throw new DokionError("REGISTRY_CACHE_CORRUPT", "Registry cache entry is partial and cannot be replaced.", {
          artifactState,
          evidenceState,
          object: cacheObjectReference(options.cacheRoot, options.expectedArtifactDigest)
        });
      }
      return verifyExisting(options, artifactPath, evidencePath);
    }

    let evidencePublished = false;
    try {
      await writeSyncedExclusive(temporaryArtifactPath, options.bytes);
      const candidate = await verifyCandidate(temporaryArtifactPath, options);
      const evidence = expectedEvidence(options, candidate.verification);
      await chmod(temporaryArtifactPath, 0o444);
      await writeSyncedExclusive(temporaryEvidencePath, registryPullEvidenceBytes(evidence));
      await chmod(temporaryEvidencePath, 0o444);

      await link(temporaryEvidencePath, evidencePath);
      evidencePublished = true;
      await unlinkIfPresent(temporaryEvidencePath);

      try {
        await link(temporaryArtifactPath, artifactPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          await unlinkIfPresent(evidencePath);
          evidencePublished = false;
          await unlinkIfPresent(temporaryArtifactPath);
          return verifyExisting(options, artifactPath, evidencePath);
        }
        throw error;
      }
      await unlinkIfPresent(temporaryArtifactPath);
      await syncDirectory(directory);
      await syncDirectory(dirname(directory));

      const finalArtifact = await pathState(artifactPath);
      const finalEvidence = await pathState(evidencePath);
      if (finalArtifact !== "file" || finalEvidence !== "file") {
        throw new DokionError("REGISTRY_CACHE_CONFLICT", "Registry cache publication did not produce a complete object.");
      }
      return {
        cachePath: artifactPath,
        evidencePath,
        cacheHit: false,
        packageVerification: candidate.verification,
        evidence
      };
    } catch (error) {
      await unlinkIfPresent(temporaryArtifactPath).catch(() => undefined);
      await unlinkIfPresent(temporaryEvidencePath).catch(() => undefined);
      if (evidencePublished && (await pathState(artifactPath).catch(() => "missing")) === "missing") {
        await unlinkIfPresent(evidencePath).catch(() => undefined);
      }
      throw error;
    }
  });
}
