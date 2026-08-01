import { sha256 } from "../../core/digest.ts";
import { DokionError } from "../../core/errors.ts";
import { validatePlaybookData } from "../../contracts/schema-validator.ts";
import { validateRegistryProtocolDocument } from "../protocol-validator.ts";
import { canonicalJson } from "./canonical-json.ts";
import { parseBoundedUstar } from "./ustar.ts";
import {
  packageLimits,
  type PackageFileEvidence,
  type PackageLimits,
  type PackageManifest,
  type VerifiedPlaybookPackage
} from "./types.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export interface PackageVerificationOptions {
  limits?: Partial<PackageLimits>;
  expectedArtifactDigest?: string;
  expectedManifestDigest?: string;
}

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch (error) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", `${label} is not valid UTF-8 JSON`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function assertFixedMetadata(path: string, mode: number, uid: number, gid: number, mtime: number): void {
  if (mode !== 0o644 || uid !== 0 || gid !== 0 || mtime !== 0) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Package entry metadata is not deterministic", {
      path,
      mode,
      uid,
      gid,
      mtime
    });
  }
}

export async function verifyPlaybookPackage(
  repositoryRoot: string,
  artifactBytes: Uint8Array,
  options: PackageVerificationOptions = {}
): Promise<VerifiedPlaybookPackage> {
  const limits = packageLimits(options.limits);
  const artifactDigest = sha256(artifactBytes);
  if (options.expectedArtifactDigest && artifactDigest !== options.expectedArtifactDigest) {
    throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Package artifact digest does not match the expected Registry digest", {
      expected: options.expectedArtifactDigest,
      observed: artifactDigest
    });
  }

  const parsed = parseBoundedUstar(artifactBytes, limits);
  if (parsed.entries[0]?.path !== "manifest.json") {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Package must begin with one root manifest.json entry");
  }
  const manifests = parsed.entries.filter((entry) => entry.path === "manifest.json");
  if (manifests.length !== 1) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Package must contain exactly one root manifest.json entry", {
      observed: manifests.length
    });
  }

  for (const entry of parsed.entries) {
    assertFixedMetadata(entry.path, entry.mode, entry.uid, entry.gid, entry.mtime);
  }

  const manifestEntry = manifests[0]!;
  const manifestDigest = sha256(manifestEntry.bytes);
  if (options.expectedManifestDigest && manifestDigest !== options.expectedManifestDigest) {
    throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Package manifest digest does not match the expected Registry digest", {
      expected: options.expectedManifestDigest,
      observed: manifestDigest
    });
  }

  const manifest = parseJson(manifestEntry.bytes, "Package manifest") as PackageManifest;
  await validateRegistryProtocolDocument(repositoryRoot, "dokion.package-manifest.v1", manifest);

  const canonicalManifestBytes = encoder.encode(canonicalJson(manifest));
  if (!bytesEqual(canonicalManifestBytes, manifestEntry.bytes)) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", "Package manifest bytes are not canonical", {
      expectedDigest: sha256(canonicalManifestBytes),
      observedDigest: manifestDigest
    });
  }

  const payloadEntries = parsed.entries.slice(1);
  const observedPaths = payloadEntries.map((entry) => entry.path);
  const sortedPaths = [...observedPaths].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
  if (observedPaths.some((path, index) => path !== sortedPaths[index])) {
    throw new DokionError("PACKAGE_ARCHIVE_INVALID", "Package payload entries are not in deterministic path order", {
      observedPaths
    });
  }

  const manifestFiles = manifest.files;
  if (manifestFiles.length !== payloadEntries.length) {
    throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Package payload count does not match the manifest inventory", {
      manifestFiles: manifestFiles.length,
      archiveFiles: payloadEntries.length
    });
  }

  const evidenceByPath = new Map<string, PackageFileEvidence>();
  for (const evidence of manifestFiles) evidenceByPath.set(evidence.path, evidence);

  for (const entry of payloadEntries) {
    const evidence = evidenceByPath.get(entry.path);
    if (!evidence) {
      throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Archive contains a payload file not listed in the manifest", {
        path: entry.path
      });
    }
    if (entry.size !== evidence.size || entry.digest !== evidence.digest) {
      throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Package payload evidence does not match the manifest", {
        path: entry.path,
        expectedSize: evidence.size,
        observedSize: entry.size,
        expectedDigest: evidence.digest,
        observedDigest: entry.digest
      });
    }
  }

  for (const evidence of manifestFiles) {
    if (!payloadEntries.some((entry) => entry.path === evidence.path)) {
      throw new DokionError("PACKAGE_INTEGRITY_MISMATCH", "Manifest lists a payload file missing from the archive", {
        path: evidence.path
      });
    }
  }

  const playbookEntry = payloadEntries.find((entry) => entry.path === manifest.playbook_path);
  if (!playbookEntry) {
    throw new DokionError("PACKAGE_MANIFEST_INVALID", "Manifest playbook_path is missing from the archive", {
      path: manifest.playbook_path
    });
  }
  await validatePlaybookData(repositoryRoot, parseJson(playbookEntry.bytes, "Packaged Playbook"), manifest.playbook_path);

  return {
    manifest,
    manifestBytes: manifestEntry.bytes,
    manifestDigest,
    artifactDigest,
    artifactSize: artifactBytes.byteLength,
    files: manifest.files,
    authority: manifest.authority,
    inspection: parsed.inspection
  };
}
