export const DEFAULT_PACKAGE_LIMITS = Object.freeze({
  maximumFiles: 10_000,
  maximumFileBytes: 16 * 1024 * 1024,
  maximumExpandedBytes: 256 * 1024 * 1024,
  maximumArchiveBytes: 300 * 1024 * 1024,
  maximumManifestBytes: 4 * 1024 * 1024,
  maximumPathBytes: 255
});

export interface PackageLimits {
  maximumFiles: number;
  maximumFileBytes: number;
  maximumExpandedBytes: number;
  maximumArchiveBytes: number;
  maximumManifestBytes: number;
  maximumPathBytes: number;
}

export interface PackageBuildMetadata {
  namespace: string;
  name: string;
  version: string;
  description?: string;
  minimumDokionVersion: string;
  maximumDokionVersion?: string;
  platforms?: readonly ("darwin-arm64" | "darwin-x64" | "linux-arm64" | "linux-x64" | "windows-x64")[];
  declaredCapabilities?: readonly string[];
  playbookPath?: string;
  readmePath?: string;
  licensePath?: string;
}

export interface PackageBuildRequest {
  repositoryRoot: string;
  sourceDirectory: string;
  metadata: PackageBuildMetadata;
  limits?: Partial<PackageLimits>;
}

export interface PackageFileEvidence {
  path: string;
  kind: "file";
  media_type: string;
  size: number;
  digest: string;
}

export interface PackageManifest {
  schema: "dokion.package-manifest.v1";
  package: {
    namespace: string;
    name: string;
    version: string;
    description?: string;
  };
  package_format: "dokion-package-tar-v1";
  playbook_path: string;
  readme_path: string;
  license_path: string;
  compatibility: {
    minimum_dokion_version: string;
    maximum_dokion_version?: string;
    platforms?: readonly string[];
  };
  declared_capabilities?: readonly string[];
  files: PackageFileEvidence[];
  authority: PackageAuthority;
}

export interface PackageAuthority {
  selection_authority: false;
  substitution_authority: false;
  installation_authority: false;
  activation_authority: false;
  execution_authority: false;
}

export interface TarInspectionEntry {
  path: string;
  type: "file";
  mode: number;
  uid: number;
  gid: number;
  mtime: number;
  size: number;
  headerOffset: number;
  dataOffset: number;
  digest: string;
}

export interface PackageInspection {
  entries: TarInspectionEntry[];
  archiveBytes: number;
  expandedBytes: number;
  terminatedAt: number;
}

export interface BuiltPlaybookPackage {
  manifest: PackageManifest;
  manifestBytes: Uint8Array;
  manifestDigest: string;
  artifactBytes: Uint8Array;
  artifactDigest: string;
  artifactSize: number;
  inspection: PackageInspection;
}

export interface VerifiedPlaybookPackage {
  manifest: PackageManifest;
  manifestBytes: Uint8Array;
  manifestDigest: string;
  artifactDigest: string;
  artifactSize: number;
  files: PackageFileEvidence[];
  authority: PackageAuthority;
  inspection: PackageInspection;
}

export interface TarSourceEntry {
  path: string;
  bytes: Uint8Array;
}

export function packageLimits(overrides: Partial<PackageLimits> = {}): PackageLimits {
  return { ...DEFAULT_PACKAGE_LIMITS, ...overrides };
}
