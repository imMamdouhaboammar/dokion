import { canonicalJsonBytes } from "./digests.ts";
import type { RegistryPackageVerificationEvidence } from "./package-verifier.ts";
import type { RegistrySourceEvidence } from "./source-client.ts";

export interface RegistryPullCacheEvidence {
  schema: "dokion.registry-pull-evidence.v1";
  source: RegistrySourceEvidence;
  index: {
    digest: `sha256:${string}`;
    size: number;
  };
  package: {
    id: string;
    version: string;
  };
  artifact: {
    digest: `sha256:${string}`;
    size: number;
  };
  manifest: {
    digest: `sha256:${string}`;
    size: number;
  };
  verification: {
    valid: true;
    fileCount: number;
    compatible: true;
    extracted: false;
    installed: false;
    activated: false;
  };
  authority: {
    selection: false;
    substitution: false;
    installation: false;
    activation: false;
    execution: false;
  };
}

export interface CreateRegistryPullEvidenceOptions {
  source: RegistrySourceEvidence;
  indexDigest: `sha256:${string}`;
  indexSize: number;
  packageId: string;
  version: string;
  artifactDigest: `sha256:${string}`;
  artifactSize: number;
  manifestDigest: `sha256:${string}`;
  manifestSize: number;
  verification: RegistryPackageVerificationEvidence;
}

export function createRegistryPullEvidence(options: CreateRegistryPullEvidenceOptions): RegistryPullCacheEvidence {
  return {
    schema: "dokion.registry-pull-evidence.v1",
    source: { ...options.source },
    index: {
      digest: options.indexDigest,
      size: options.indexSize
    },
    package: {
      id: options.packageId,
      version: options.version
    },
    artifact: {
      digest: options.artifactDigest,
      size: options.artifactSize
    },
    manifest: {
      digest: options.manifestDigest,
      size: options.manifestSize
    },
    verification: {
      valid: true,
      fileCount: options.verification.files.length,
      compatible: true,
      extracted: false,
      installed: false,
      activated: false
    },
    authority: {
      selection: false,
      substitution: false,
      installation: false,
      activation: false,
      execution: false
    }
  };
}

export function registryPullEvidenceBytes(evidence: RegistryPullCacheEvidence): Uint8Array {
  return canonicalJsonBytes(evidence);
}
