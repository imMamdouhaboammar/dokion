import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { DokionError } from "../core/errors.ts";
import { canonicalJsonBytes, compareUtf8Bytes, sha256Digest } from "./digests.ts";
import type {
  RegistryPackageCompatibility,
  RegistryPackageIdentity,
  RegistryPackageManifest,
  RegistryPackageManifestFile
} from "./package-manifest.ts";
import { parseRegistryPackageManifest } from "./package-manifest.ts";
import { assertUniquePackagePaths, normalizePackagePath } from "./package-paths.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";
import { createDeterministicPackageTar, type RegistryTarEntry } from "./package-tar.ts";

const BUILD_CONFIG = "dokion-package.json";
const REQUIRED_FILES = ["playbook.json", "README.md", "LICENSE"] as const;
const AUTHORITY_KEYS = new Set([
  "authority",
  "selection_authority",
  "substitution_authority",
  "installation_authority",
  "activation_authority",
  "execution_authority",
  "verified",
  "trust_state"
]);
const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "prepublishOnly",
  "publish",
  "postpublish"
]);

interface RegistryPackageBuildConfig {
  schema: "dokion.package-build.v1";
  package: RegistryPackageIdentity;
  compatibility: RegistryPackageCompatibility;
  declared_capabilities?: string[];
  files?: string[];
}

export interface BuildRegistryPackageOptions {
  sourceDirectory: string;
  outputPath: string;
  overwrite?: boolean;
}

export interface RegistryPackageBuildEvidence {
  archivePath: string;
  artifactDigest: `sha256:${string}`;
  artifactSize: number;
  manifestDigest: `sha256:${string}`;
  packageId: string;
  version: string;
  manifest: RegistryPackageManifest;
  installed: false;
  activated: false;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `${label} contains unsupported fields.`, {
      fields: unknown.sort(compareUtf8Bytes)
    });
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `${label} must be a non-empty string.`);
  }
  return value;
}

function optionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `${label} must be an array of non-empty strings.`);
  }
  return value as string[];
}

function containsAuthorityClaim(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => containsAuthorityClaim(item));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => AUTHORITY_KEYS.has(key) || containsAuthorityClaim(item)
  );
}

function parseBuildConfig(bytes: Uint8Array): RegistryPackageBuildConfig {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `${BUILD_CONFIG} must contain valid UTF-8 JSON.`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (containsAuthorityClaim(value)) {
    throw new DokionError("REGISTRY_PACKAGE_AUTHORITY_CLAIM", "Package build metadata may not carry trust or authority claims.");
  }

  const config = record(value, BUILD_CONFIG);
  assertKeys(config, ["schema", "package", "compatibility", "declared_capabilities", "files"], BUILD_CONFIG);
  if (config.schema !== "dokion.package-build.v1") {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", "Unsupported package build schema.", {
      schema: config.schema
    });
  }

  const packageValue = record(config.package, "package");
  assertKeys(packageValue, ["namespace", "name", "version", "description"], "package");
  const packageIdentity: RegistryPackageIdentity = {
    namespace: requiredString(packageValue.namespace, "package.namespace"),
    name: requiredString(packageValue.name, "package.name"),
    version: requiredString(packageValue.version, "package.version"),
    ...(packageValue.description === undefined
      ? {}
      : { description: requiredString(packageValue.description, "package.description") })
  };

  const compatibilityValue = record(config.compatibility, "compatibility");
  assertKeys(compatibilityValue, ["minimum_dokion_version", "maximum_dokion_version", "platforms"], "compatibility");
  const platforms = optionalStringArray(compatibilityValue.platforms, "compatibility.platforms");
  const compatibility: RegistryPackageCompatibility = {
    minimum_dokion_version: requiredString(
      compatibilityValue.minimum_dokion_version,
      "compatibility.minimum_dokion_version"
    ),
    ...(compatibilityValue.maximum_dokion_version === undefined
      ? {}
      : {
          maximum_dokion_version: requiredString(
            compatibilityValue.maximum_dokion_version,
            "compatibility.maximum_dokion_version"
          )
        }),
    ...(platforms ? { platforms } : {})
  };

  const declaredCapabilities = optionalStringArray(config.declared_capabilities, "declared_capabilities");
  const files = optionalStringArray(config.files, "files");
  return {
    schema: "dokion.package-build.v1",
    package: packageIdentity,
    compatibility,
    ...(declaredCapabilities ? { declared_capabilities: declaredCapabilities } : {}),
    ...(files ? { files } : {})
  };
}

async function assertSafeSourcePath(sourceDirectory: string, packagePath: string): Promise<void> {
  const segments = packagePath.split("/");
  let current = sourceDirectory;
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT" || errorCode === "ENOTDIR") {
        throw new DokionError("REGISTRY_PACKAGE_REQUIRED_FILE_MISSING", `Missing declared package file: ${packagePath}`, {
          path: packagePath
        });
      }
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new DokionError(
        "REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED",
        `Package source path components must be real directories: ${packagePath}`,
        { path: packagePath, component: current }
      );
    }
  }
}

async function readRegularFile(path: string, packagePath: string): Promise<Uint8Array> {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === "ENOENT" || errorCode === "ENOTDIR") {
      throw new DokionError("REGISTRY_PACKAGE_REQUIRED_FILE_MISSING", `Missing declared package file: ${packagePath}`, {
        path: packagePath
      });
    }
    throw new DokionError("REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED", `Package input must be a regular non-symlink file: ${packagePath}`, {
      path: packagePath,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new DokionError("REGISTRY_PACKAGE_ENTRY_TYPE_UNSUPPORTED", `Package input must be a single-link regular file: ${packagePath}`, {
        path: packagePath,
        links: stat.nlink
      });
    }
    if (stat.size > REGISTRY_PACKAGE_LIMITS.maximumFileBytes) {
      throw new DokionError("REGISTRY_PACKAGE_FILE_TOO_LARGE", `Package input exceeds the individual file bound: ${packagePath}`, {
        path: packagePath,
        size: stat.size,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumFileBytes
      });
    }
    const bytes = await handle.readFile();
    if (bytes.length !== stat.size) {
      throw new DokionError("REGISTRY_PACKAGE_ARCHIVE_INVALID", `Package input changed while it was read: ${packagePath}`, {
        path: packagePath,
        expectedSize: stat.size,
        observedSize: bytes.length
      });
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function mediaType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "application/yaml";
  if (lower.endsWith(".toml")) return "application/toml";
  if (lower.endsWith(".txt") || basename(path).toUpperCase() === "LICENSE") return "text/plain";
  return "application/octet-stream";
}

function rejectLifecycleScripts(path: string, bytes: Uint8Array): void {
  if (basename(path).toLowerCase() !== "package.json") return;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", `Declared package.json is not valid JSON: ${path}`, {
      path
    });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const scripts = (value as Record<string, unknown>).scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return;
  const lifecycle = Object.keys(scripts as Record<string, unknown>).filter((name) => LIFECYCLE_SCRIPTS.has(name));
  if (lifecycle.length > 0) {
    throw new DokionError("REGISTRY_PACKAGE_LIFECYCLE_SCRIPT", `Lifecycle scripts are forbidden in Registry packages: ${path}`, {
      path,
      scripts: lifecycle.sort(compareUtf8Bytes)
    });
  }
}

async function syncDirectory(path: string): Promise<void> {
  let handle;
  try {
    handle = await open(path, "r");
    await handle.sync();
  } catch {
    // Directory fsync is not supported on every platform. The file itself is always fsynced.
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function publishArtifact(bytes: Uint8Array, outputPath: string, overwrite: boolean): Promise<void> {
  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  const temporaryPath = join(
    outputDirectory,
    `.${basename(outputPath)}.dokion-tmp-${process.pid}-${randomUUID()}`
  );

  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle?.close().catch(() => undefined);
  }

  try {
    if (overwrite) {
      await rename(temporaryPath, outputPath);
    } else {
      try {
        await link(temporaryPath, outputPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          throw new DokionError("REGISTRY_PACKAGE_OUTPUT_EXISTS", `Package output already exists: ${outputPath}`, {
            outputPath
          });
        }
        throw error;
      }
      await unlink(temporaryPath);
    }
    await syncDirectory(outputDirectory);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function buildRegistryPackage(options: BuildRegistryPackageOptions): Promise<RegistryPackageBuildEvidence> {
  const sourceDirectory = resolve(options.sourceDirectory);
  const outputPath = resolve(options.outputPath);
  const sourceStat = await lstat(sourceDirectory).catch(() => null);
  if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", "Package source must be a real directory.", {
      sourceDirectory
    });
  }

  const configBytes = await readRegularFile(join(sourceDirectory, BUILD_CONFIG), BUILD_CONFIG);
  const config = parseBuildConfig(configBytes);

  const paths = [...REQUIRED_FILES, ...(config.files ?? [])].map((path) => normalizePackagePath(path));
  if (paths.includes("manifest.json") || paths.includes(BUILD_CONFIG)) {
    throw new DokionError("REGISTRY_PACKAGE_CONFIG_INVALID", "manifest.json and dokion-package.json are generated or build-only and may not be declared as payload files.");
  }
  assertUniquePackagePaths(paths);
  const sortedPaths = [...paths].sort(compareUtf8Bytes);

  const tarEntries: RegistryTarEntry[] = [];
  const manifestFiles: RegistryPackageManifestFile[] = [];
  let totalPayloadBytes = 0;
  for (const path of sortedPaths) {
    await assertSafeSourcePath(sourceDirectory, path);
    const bytes = await readRegularFile(join(sourceDirectory, ...path.split("/")), path);
    rejectLifecycleScripts(path, bytes);
    totalPayloadBytes += bytes.length;
    if (totalPayloadBytes > REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes) {
      throw new DokionError("REGISTRY_PACKAGE_TOO_LARGE", "Package payload exceeds the total unpacked size bound.", {
        size: totalPayloadBytes,
        maximum: REGISTRY_PACKAGE_LIMITS.maximumTotalPayloadBytes
      });
    }
    tarEntries.push({ path, bytes });
    manifestFiles.push({
      path,
      kind: "file",
      media_type: mediaType(path),
      size: bytes.length,
      digest: sha256Digest(bytes)
    });
  }

  const manifestValue: RegistryPackageManifest = {
    schema: "dokion.package-manifest.v1",
    package: config.package,
    package_format: "dokion-package-tar-v1",
    playbook_path: "playbook.json",
    readme_path: "README.md",
    license_path: "LICENSE",
    compatibility: config.compatibility,
    ...(config.declared_capabilities
      ? { declared_capabilities: [...new Set(config.declared_capabilities)].sort(compareUtf8Bytes) }
      : {}),
    files: manifestFiles,
    authority: {
      selection_authority: false,
      substitution_authority: false,
      installation_authority: false,
      activation_authority: false,
      execution_authority: false
    }
  };
  const manifestBytes = canonicalJsonBytes(manifestValue);
  const manifest = parseRegistryPackageManifest(manifestBytes);
  const archiveBytes = createDeterministicPackageTar([...tarEntries, { path: "manifest.json", bytes: manifestBytes }]);
  await publishArtifact(archiveBytes, outputPath, options.overwrite === true);

  return {
    archivePath: outputPath,
    artifactDigest: sha256Digest(archiveBytes),
    artifactSize: archiveBytes.length,
    manifestDigest: sha256Digest(manifestBytes),
    packageId: `${manifest.package.namespace}/${manifest.package.name}`,
    version: manifest.package.version,
    manifest,
    installed: false,
    activated: false
  };
}
