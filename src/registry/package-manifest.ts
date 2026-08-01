import type { ErrorObject } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import commonSchema from "../../schemas/registry/common.schema.json";
import packageManifestSchema from "../../schemas/registry/dokion.package-manifest.v1.schema.json";
import { DokionError } from "../core/errors.ts";
import { validateRegistryDocumentSemantics } from "./protocol-semantics.ts";
import { REGISTRY_PACKAGE_LIMITS } from "./package-limits.ts";

export interface RegistryPackageIdentity {
  namespace: string;
  name: string;
  version: string;
  description?: string;
}

export interface RegistryPackageCompatibility {
  minimum_dokion_version: string;
  maximum_dokion_version?: string;
  platforms?: string[];
}

export interface RegistryPackageManifestFile {
  path: string;
  kind: "file";
  media_type: string;
  size: number;
  digest: `sha256:${string}`;
}

export interface RegistryPackageManifest {
  schema: "dokion.package-manifest.v1";
  package: RegistryPackageIdentity;
  package_format: "dokion-package-tar-v1";
  playbook_path: string;
  readme_path: string;
  license_path: string;
  compatibility: RegistryPackageCompatibility;
  declared_capabilities?: string[];
  files: RegistryPackageManifestFile[];
  authority: {
    selection_authority: false;
    substitution_authority: false;
    installation_authority: false;
    activation_authority: false;
    execution_authority: false;
  };
}

const ajv = new Ajv2020({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(commonSchema);
const validateManifest = ajv.compile(packageManifestSchema);
const decoder = new TextDecoder("utf-8", { fatal: true });

function authorityClaim(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const authority = (value as Record<string, unknown>).authority;
  if (!authority || typeof authority !== "object" || Array.isArray(authority)) return false;
  return Object.values(authority as Record<string, unknown>).some((item) => item !== false);
}

function simplifiedErrors(errors: ErrorObject[] | null | undefined): Array<Record<string, unknown>> {
  return (errors ?? []).map((error) => ({
    path: error.instancePath,
    keyword: error.keyword,
    message: error.message
  }));
}

export function parseRegistryPackageManifest(bytes: Uint8Array): RegistryPackageManifest {
  if (bytes.length > REGISTRY_PACKAGE_LIMITS.maximumManifestBytes) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package manifest exceeds the bounded manifest size.", {
      size: bytes.length,
      maximum: REGISTRY_PACKAGE_LIMITS.maximumManifestBytes
    });
  }

  let source: string;
  try {
    source = decoder.decode(bytes);
  } catch {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package manifest is not valid UTF-8.");
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package manifest is not valid JSON.", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  if (authorityClaim(value)) {
    throw new DokionError("REGISTRY_PACKAGE_AUTHORITY_CLAIM", "Package metadata may not claim selection, installation, activation, substitution, or execution authority.");
  }

  if (!validateManifest(value)) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package manifest does not conform to dokion.package-manifest.v1.", {
      errors: simplifiedErrors(validateManifest.errors)
    });
  }

  const semanticErrors = validateRegistryDocumentSemantics(
    "dokion.package-manifest.v1",
    value as Record<string, unknown>
  );
  if (semanticErrors.length > 0) {
    throw new DokionError("REGISTRY_PACKAGE_MANIFEST_INVALID", "Package manifest violates semantic protocol invariants.", {
      errors: semanticErrors.map((error) => ({ path: error.path, keyword: error.keyword, message: error.message }))
    });
  }

  return value as unknown as RegistryPackageManifest;
}
