import { sha256 } from "../../core/digest.ts";
import { DokionError } from "../../core/errors.ts";
import { validatePlaybookData } from "../../contracts/schema-validator.ts";
import { validateRegistryProtocolDocument } from "../protocol-validator.ts";
import { canonicalJson } from "./canonical-json.ts";
import { verifyPlaybookPackage } from "./package-verifier.ts";
import { inventoryPackageSource } from "./source-inventory.ts";
import { writeDeterministicUstar } from "./ustar.ts";
import {
  packageLimits,
  type BuiltPlaybookPackage,
  type PackageAuthority,
  type PackageBuildRequest,
  type PackageManifest
} from "./types.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

const NO_AUTHORITY: PackageAuthority = Object.freeze({
  selection_authority: false,
  substitution_authority: false,
  installation_authority: false,
  activation_authority: false,
  execution_authority: false
});

function parsePlaybook(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch (error) {
    throw new DokionError("PACKAGE_SOURCE_INVALID", "Package Playbook is not valid UTF-8 JSON", {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function buildPlaybookPackage(request: PackageBuildRequest): Promise<BuiltPlaybookPackage> {
  const limits = packageLimits(request.limits);
  const playbookPath = request.metadata.playbookPath ?? "playbook.json";
  const readmePath = request.metadata.readmePath ?? "README.md";
  const licensePath = request.metadata.licensePath ?? "LICENSE";
  const inventory = await inventoryPackageSource(request.sourceDirectory, limits);
  const entryByPath = new Map(inventory.entries.map((entry) => [entry.path, entry]));

  for (const requiredPath of [playbookPath, readmePath, licensePath]) {
    if (!entryByPath.has(requiredPath)) {
      throw new DokionError("PACKAGE_SOURCE_INVALID", "Package source is missing a required core file", {
        path: requiredPath
      });
    }
  }

  const playbookEntry = entryByPath.get(playbookPath)!;
  await validatePlaybookData(request.repositoryRoot, parsePlaybook(playbookEntry.bytes, playbookPath), playbookPath);

  const manifest: PackageManifest = {
    schema: "dokion.package-manifest.v1",
    package: {
      namespace: request.metadata.namespace,
      name: request.metadata.name,
      version: request.metadata.version,
      ...(request.metadata.description !== undefined ? { description: request.metadata.description } : {})
    },
    package_format: "dokion-package-tar-v1",
    playbook_path: playbookPath,
    readme_path: readmePath,
    license_path: licensePath,
    compatibility: {
      minimum_dokion_version: request.metadata.minimumDokionVersion,
      ...(request.metadata.maximumDokionVersion !== undefined
        ? { maximum_dokion_version: request.metadata.maximumDokionVersion }
        : {}),
      ...(request.metadata.platforms !== undefined ? { platforms: [...request.metadata.platforms] } : {})
    },
    ...(request.metadata.declaredCapabilities !== undefined
      ? { declared_capabilities: [...request.metadata.declaredCapabilities] }
      : {}),
    files: inventory.files,
    authority: NO_AUTHORITY
  };

  await validateRegistryProtocolDocument(request.repositoryRoot, "dokion.package-manifest.v1", manifest);
  const manifestBytes = encoder.encode(canonicalJson(manifest));
  if (manifestBytes.byteLength > limits.maximumManifestBytes) {
    throw new DokionError("PACKAGE_LIMIT_EXCEEDED", "Generated package manifest exceeds its byte limit", {
      bytes: manifestBytes.byteLength,
      maximum: limits.maximumManifestBytes
    });
  }

  const manifestDigest = sha256(manifestBytes);
  const artifactBytes = writeDeterministicUstar(
    [{ path: "manifest.json", bytes: manifestBytes }, ...inventory.entries],
    limits
  );
  const artifactDigest = sha256(artifactBytes);
  const verified = await verifyPlaybookPackage(request.repositoryRoot, artifactBytes, {
    limits,
    expectedArtifactDigest: artifactDigest,
    expectedManifestDigest: manifestDigest
  });

  return {
    manifest,
    manifestBytes,
    manifestDigest,
    artifactBytes,
    artifactDigest,
    artifactSize: artifactBytes.byteLength,
    inspection: verified.inspection
  };
}
