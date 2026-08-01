import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { DokionError } from "../core/errors.ts";
import { DOKION_VERSION } from "../runtime/package-metadata.ts";
import { compareExactSemver, sha256Digest } from "./digests.ts";
import type { RegistryPackageManifest, RegistryPackageManifestFile } from "./package-manifest.ts";
import { parseRegistryPackageManifest } from "./package-manifest.ts";
import { assertUniquePackagePaths, normalizePackagePath } from "./package-paths.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";
import { readRegistryPackageTar } from "./package-tar.ts";

export interface VerifyRegistryPackageOptions {
  archivePath: string;
  expectedPackageId?: string;
  expectedVersion?: string;
}

export interface RegistryPackageVerificationFile {
  path: string;
  size: number;
  digest: `sha256:${string}`;
  mediaType: string;
}

export interface RegistryPackageVerificationEvidence {
  valid: true;
  archivePath: string;
  artifactDigest: `sha256:${string}`;
  artifactSize: number;
  manifestDigest: `sha256:${string}`;
  packageId: string;
  version: string;
  compatibility: {
    state: "COMPATIBLE";
    currentDokionVersion: string;
    currentPlatform: string;
    minimumDokionVersion: string;
    maximumDokionVersion?: string;
  };
  files: RegistryPackageVerificationFile[];
  authority: RegistryPackageManifest["authority"];
  extracted: false;
  installed: false;
  activated: false;
}

function currentPlatformId(): string {
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const architecture = process.arch === "x64" || process.arch === "arm64" ? process.arch : "unsupported";
  return `${platform}-${architecture}`;
}

function verifyCompatibility(manifest: RegistryPackageManifest): RegistryPackageVerificationEvidence["compatibility"] {
  const compatibility = manifest.compatibility;
  const currentPlatform = currentPlatformId();
  if (compareExactSemver(DOKION_VERSION, compatibility.minimum_dokion_version) < 0) {
    throw new DokionError("REGISTRY_PACKAGE_INCOMPATIBLE", "Package requires a newer Dokion version.", {
      currentVersion: DOKION_VERSION,
      minimumVersion: compatibility.minimum_dokion_version
    });
  }
  if (
    compatibility.maximum_dokion_version &&
    compareExactSemver(DOKION_VERSION, compatibility.maximum_dokion_version) > 0
  ) {
    throw new DokionError("REGISTRY_PACKAGE_INCOMPATIBLE", "Package does not support this Dokion version.", {
      currentVersion: DOKION_VERSION,
      maximumVersion: compatibility.maximum_dokion_version
    });
  }
  if (compatibility.platforms && !compatibility.platforms.includes(currentPlatform)) {
    throw new DokionError("REGISTRY_PACKAGE_INCOMPATIBLE", "Package does not support the current platform.", {
      currentPlatform,
      supportedPlatforms: compatibility.platforms
    });
  }
  return {
    state: "COMPATIBLE",
    currentDokionVersion: DOKION_VERSION,
    currentPlatform,
    minimumDokionVersion: compatibility.minimum_dokion_version,
    ...(compatibility.maximum_dokion_version
      ? { maximumDokionVersion: compatibility.maximum_dokion_version }
      : {})
  };
}

function manifestFileMap(files: readonly RegistryPackageManifestFile[]): Map<string, RegistryPackageManifestFile> {
  assertUniquePackagePaths(files.map((file) => file.path));
  return new Map(files.map((file) => [normalizePackagePath(file.path), file]));
}

export async function verifyRegistryPackage(
  options: VerifyRegistryPackageOptions
): Promise<RegistryPackageVerificationEvidence> {
  const archivePath = resolve(options.archivePath);
  const stat = await lstat(archivePath).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Package archive must be a regular non-symlink file.", {
      archivePath
    });
  }
  if (stat.size > REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes) {
    throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package archive exceeds the archive size bound.", {
      size: stat.size,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumArchiveBytes
    });
  }

  const archiveBytes = await readFile(archivePath);
  if (archiveBytes.length !== stat.size) {
    throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", "Package archive changed while it was read.", {
      archivePath,
      expectedSize: stat.size,
      observedSize: archiveBytes.length
    });
  }

  const entries = readRegistryPackageTar(archiveBytes);
  const manifestEntries = entries.filter((entry) => entry.path === "manifest.json");
  if (manifestEntries.length !== 1) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package archive must contain exactly one manifest.json.", {
      count: manifestEntries.length
    });
  }
  const manifestEntry = manifestEntries[0]!;
  const manifest = parseRegistryPackageManifest(manifestEntry.bytes);
  const packageId = `${manifest.package.namespace}/${manifest.package.name}`;

  if (options.expectedPackageId && options.expectedPackageId !== packageId) {
    throw new DokionError("REGISTRY_PACKAGE_ID_MISMATCH", "Package identity does not match the expected Registry identity.", {
      expected: options.expectedPackageId,
      observed: packageId
    });
  }
  if (options.expectedVersion && options.expectedVersion !== manifest.package.version) {
    throw new DokionError("REGISTRY_PACKAGE_VERSION_MISMATCH", "Package version does not match the expected exact version.", {
      expected: options.expectedVersion,
      observed: manifest.package.version
    });
  }

  const declared = manifestFileMap(manifest.files);
  for (const requiredPath of [manifest.playbook_path, manifest.readme_path, manifest.license_path]) {
    if (!declared.has(normalizePackagePath(requiredPath))) {
      throw new DokionError("REGISTRY_PACKAGE_DECLARED_FILE_MISSING", `Required package path is not declared: ${requiredPath}`, {
        path: requiredPath
      });
    }
  }

  const payloadEntries = entries.filter((entry) => entry.path !== "manifest.json");
  const observed = new Map(payloadEntries.map((entry) => [entry.path, entry]));
  for (const entry of payloadEntries) {
    if (!declared.has(entry.path)) {
      throw new DokionError("REGISTRY_PACKAGE_UNDECLARED_FILE", `Archive contains an undeclared file: ${entry.path}`, {
        path: entry.path
      });
    }
  }
  for (const path of declared.keys()) {
    if (!observed.has(path)) {
      throw new DokionError("REGISTRY_PACKAGE_DECLARED_FILE_MISSING", `Manifest declares a file absent from the archive: ${path}`, {
        path
      });
    }
  }

  const verifiedFiles: RegistryPackageVerificationFile[] = [];
  for (const [path, declaration] of [...declared.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const entry = observed.get(path)!;
    if (entry.bytes.length !== declaration.size) {
      throw new DokionError("REGISTRY_PACKAGE_SIZE_MISMATCH", `Package file size does not match its manifest declaration: ${path}`, {
        path,
        expected: declaration.size,
        observed: entry.bytes.length
      });
    }
    const digest = sha256Digest(entry.bytes);
    if (digest !== declaration.digest) {
      throw new DokionError("REGISTRY_PACKAGE_DIGEST_MISMATCH", `Package file digest does not match its manifest declaration: ${path}`, {
        path,
        expected: declaration.digest,
        observed: digest
      });
    }
    verifiedFiles.push({
      path,
      size: declaration.size,
      digest,
      mediaType: declaration.media_type
    });
  }

  const compatibility = verifyCompatibility(manifest);
  return {
    valid: true,
    archivePath,
    artifactDigest: sha256Digest(archiveBytes),
    artifactSize: archiveBytes.length,
    manifestDigest: sha256Digest(manifestEntry.bytes),
    packageId,
    version: manifest.package.version,
    compatibility,
    files: verifiedFiles,
    authority: manifest.authority,
    extracted: false,
    installed: false,
    activated: false
  };
}
