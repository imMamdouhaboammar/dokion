import { sha256 } from '../core/digest.ts';

export interface EvidenceManifestEntry {
  path: string;
  digest: string;
  bytes: number;
}

export interface EvidenceManifest {
  schema_version: 1;
  created_at: string;
  entries: EvidenceManifestEntry[];
  totalBytes: number;
  rootDigest: string;
}

export function computeEvidenceManifest(
  artifacts: Array<{ path: string; content: string | Uint8Array }>
): EvidenceManifest {
  const entries: EvidenceManifestEntry[] = artifacts.map((art) => {
    const bytes = typeof art.content === 'string' ? new TextEncoder().encode(art.content).byteLength : art.content.byteLength;
    const digest = sha256(art.content);
    return { path: art.path, digest, bytes };
  });

  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  const combinedDigests = entries.map((e) => e.digest).join(':');
  const rootDigest = sha256(combinedDigests);

  return {
    schema_version: 1,
    created_at: new Date().toISOString(),
    entries,
    totalBytes,
    rootDigest,
  };
}
