import { resolve } from "node:path";

import { cacheRegistryArtifact } from "./artifact-cache.ts";
import type { RegistryNetworkTransport } from "./artifact-fetcher.ts";
import type { RegistryPackageVerificationEvidence } from "./package-verifier.ts";
import { retrieveRegistryPackage } from "./source-client.ts";

export interface PullRegistryPackageOptions {
  configPath: string;
  source: string;
  packageReference: string;
  cacheRoot: string;
  networkTransport?: RegistryNetworkTransport;
  timeoutMs?: number;
  now?: Date;
}

export interface RegistryPullEvidence {
  valid: true;
  source: {
    id: string;
    name: string;
    transport: "local" | "https" | "git";
  };
  packageReference: string;
  packageId: string;
  version: string;
  artifactDigest: `sha256:${string}`;
  artifactSize: number;
  manifestDigest: `sha256:${string}`;
  manifestSize: number;
  indexDigest: `sha256:${string}`;
  indexSize: number;
  cachePath: string;
  evidencePath: string;
  cacheHit: boolean;
  retrieval: {
    transport: "local" | "https" | "git";
    redirects: number;
  };
  packageVerification: RegistryPackageVerificationEvidence;
  extracted: false;
  installed: false;
  activated: false;
  executionAuthority: false;
}

export async function pullRegistryPackage(options: PullRegistryPackageOptions): Promise<RegistryPullEvidence> {
  const retrieved = await retrieveRegistryPackage({
    configPath: resolve(options.configPath),
    source: options.source,
    packageReference: options.packageReference,
    ...(options.networkTransport ? { networkTransport: options.networkTransport } : {}),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.now === undefined ? {} : { now: options.now })
  });

  const cached = await cacheRegistryArtifact({
    cacheRoot: resolve(options.cacheRoot),
    bytes: retrieved.artifactBytes,
    expectedArtifactDigest: retrieved.packageEntry.artifact.digest,
    expectedArtifactSize: retrieved.packageEntry.artifact.size,
    expectedManifestDigest: retrieved.packageEntry.manifest.digest,
    expectedManifestSize: retrieved.packageEntry.manifest.size,
    expectedPackageId: retrieved.packageReference.packageId,
    expectedVersion: retrieved.packageReference.version,
    source: retrieved.sourceEvidence,
    indexDigest: retrieved.indexDigest,
    indexSize: retrieved.indexSize
  });

  return {
    valid: true,
    source: retrieved.sourceEvidence,
    packageReference: `${retrieved.packageReference.packageId}@${retrieved.packageReference.version}`,
    packageId: retrieved.packageReference.packageId,
    version: retrieved.packageReference.version,
    artifactDigest: retrieved.packageEntry.artifact.digest,
    artifactSize: retrieved.packageEntry.artifact.size,
    manifestDigest: retrieved.packageEntry.manifest.digest,
    manifestSize: retrieved.packageEntry.manifest.size,
    indexDigest: retrieved.indexDigest,
    indexSize: retrieved.indexSize,
    cachePath: cached.cachePath,
    evidencePath: cached.evidencePath,
    cacheHit: cached.cacheHit,
    retrieval: retrieved.retrieval,
    packageVerification: cached.packageVerification,
    extracted: false,
    installed: false,
    activated: false,
    executionAuthority: false
  };
}
