import { DokionError } from "../core/errors.ts";
import { parseExactPackageReference, type RegistryAuthorityNone } from "./source-policy.ts";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SOURCE_ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SOURCE_NAME = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;
const TAG = /^[a-z0-9][a-z0-9-]{0,31}$/;
const PACKAGE_ID = /^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,127}$/;

export interface RegistryRootIndexReference {
  location: string;
  digest: `sha256:${string}`;
  size: number;
  immutable_revision?: string;
}

export interface RegistryRootDocument {
  schema: "dokion.registry-root.v1";
  source: {
    id: string;
    name: string;
    transport: "local" | "https" | "git";
    location: string;
    immutable_revision?: string;
  };
  generated_at: string;
  expires_at: string;
  indexes: RegistryRootIndexReference[];
  authority: RegistryAuthorityNone;
}

export interface RegistryIndexPackage {
  namespace: string;
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  source: {
    transport: "local" | "https" | "git";
    location: string;
    immutable_revision?: string;
  };
  manifest: {
    location: string;
    digest: `sha256:${string}`;
    size: number;
  };
  artifact: {
    location: string;
    digest: `sha256:${string}`;
    size: number;
  };
  published_at: string;
  minimum_dokion_version: string;
  deprecation: {
    state: "CURRENT" | "DEPRECATED";
    reason?: string;
    replacement?: string;
  };
  revocation: {
    state: "CLEAR" | "REVOKED" | "UNKNOWN";
    reason?: string;
    revoked_at?: string;
  };
  provenance_location?: string;
  signature_bundle_location?: string;
}

export interface RegistryIndexDocument {
  schema: "dokion.registry-index.v1";
  source_id: string;
  generated_at: string;
  expires_at: string;
  packages: RegistryIndexPackage[];
  authority: RegistryAuthorityNone;
}

type JsonRecord = Record<string, unknown>;

function fail(code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID", message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError(code, message, details);
}

function json(bytes: Uint8Array, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    fail(code, `${label} must contain valid UTF-8 JSON.`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function record(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, `${label} must be an object.`, { field: label });
  return value as JsonRecord;
}

function keys(value: JsonRecord, allowed: readonly string[], label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  if (unknown.length > 0) fail(code, `${label} contains unsupported fields.`, { field: label, fields: unknown });
}

function string(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID", pattern?: RegExp, maximum = 2048): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || (pattern && !pattern.test(value))) {
    fail(code, `${label} is invalid.`, { field: label });
  }
  return value;
}

function optionalString(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID", pattern?: RegExp, maximum = 2048): string | undefined {
  return value === undefined ? undefined : string(value, label, code, pattern, maximum);
}

function positiveInteger(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail(code, `${label} must be a positive safe integer.`, { field: label, value });
  return value as number;
}

function timestamp(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): string {
  const result = string(value, label, code, undefined, 100);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || Number.isNaN(Date.parse(result))) {
    fail(code, `${label} must be an RFC 3339 UTC timestamp.`, { field: label, value: result });
  }
  return result;
}

function authority(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): RegistryAuthorityNone {
  const result = record(value, label, code);
  const required = [
    "selection_authority",
    "substitution_authority",
    "installation_authority",
    "activation_authority",
    "execution_authority"
  ] as const;
  keys(result, required, label, code);
  for (const name of required) {
    if (result[name] !== false) fail(code, `${label}.${name} must be false.`, { field: `${label}.${name}` });
  }
  return {
    selection_authority: false,
    substitution_authority: false,
    installation_authority: false,
    activation_authority: false,
    execution_authority: false
  };
}

function transport(value: unknown, label: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID"): "local" | "https" | "git" {
  if (value !== "local" && value !== "https" && value !== "git") fail(code, `${label} is not supported.`, { field: label, value });
  return value;
}

function requireFresh(generatedAt: string, expiresAt: string, code: "REGISTRY_DOCUMENT_INVALID" | "REGISTRY_INDEX_INVALID", now: Date): void {
  const generated = Date.parse(generatedAt);
  const expires = Date.parse(expiresAt);
  if (generated >= expires) fail(code, "Registry document expiry must be later than generation.", { generatedAt, expiresAt });
  if (expires <= now.getTime()) {
    throw new DokionError("REGISTRY_SOURCE_EXPIRED", "Registry metadata has expired.", { expiresAt });
  }
}

export function parseRegistryRoot(bytes: Uint8Array, now = new Date()): RegistryRootDocument {
  const code = "REGISTRY_DOCUMENT_INVALID" as const;
  const value = record(json(bytes, "Registry Root", code), "Registry Root", code);
  keys(value, ["schema", "source", "generated_at", "expires_at", "indexes", "authority"], "Registry Root", code);
  if (value.schema !== "dokion.registry-root.v1") fail(code, "Unsupported Registry Root schema.", { schema: value.schema });

  const sourceValue = record(value.source, "source", code);
  keys(sourceValue, ["id", "name", "transport", "location", "immutable_revision"], "source", code);
  const sourceTransport = transport(sourceValue.transport, "source.transport", code);
  const immutableRevision = optionalString(sourceValue.immutable_revision, "source.immutable_revision", code, GIT_COMMIT, 40);
  if (sourceTransport === "git" && !immutableRevision) fail(code, "Git Registry Root source requires an immutable revision.");
  if (sourceTransport !== "git" && immutableRevision) fail(code, "Only Git Registry Root sources may declare an immutable revision.");

  const generatedAt = timestamp(value.generated_at, "generated_at", code);
  const expiresAt = timestamp(value.expires_at, "expires_at", code);
  requireFresh(generatedAt, expiresAt, code, now);

  if (!Array.isArray(value.indexes) || value.indexes.length === 0) fail(code, "Registry Root must contain at least one index.", { field: "indexes" });
  const indexes = value.indexes.map((item, index): RegistryRootIndexReference => {
    const entry = record(item, `indexes[${index}]`, code);
    keys(entry, ["location", "digest", "size", "immutable_revision"], `indexes[${index}]`, code);
    const indexRevision = optionalString(entry.immutable_revision, `indexes[${index}].immutable_revision`, code, GIT_COMMIT, 40);
    if (sourceTransport === "git" && !indexRevision) fail(code, "Git Registry Root indexes require immutable revisions.", { index });
    if (sourceTransport !== "git" && indexRevision) fail(code, "Only Git Registry Root indexes may declare immutable revisions.", { index });
    return {
      location: string(entry.location, `indexes[${index}].location`, code),
      digest: string(entry.digest, `indexes[${index}].digest`, code, SHA256, 71) as `sha256:${string}`,
      size: positiveInteger(entry.size, `indexes[${index}].size`, code),
      ...(indexRevision ? { immutable_revision: indexRevision } : {})
    };
  });

  return {
    schema: "dokion.registry-root.v1",
    source: {
      id: string(sourceValue.id, "source.id", code, SOURCE_ID, 128),
      name: string(sourceValue.name, "source.name", code, SOURCE_NAME, 64),
      transport: sourceTransport,
      location: string(sourceValue.location, "source.location", code),
      ...(immutableRevision ? { immutable_revision: immutableRevision } : {})
    },
    generated_at: generatedAt,
    expires_at: expiresAt,
    indexes,
    authority: authority(value.authority, "authority", code)
  };
}

function parseLocationDigest(value: unknown, label: string): { location: string; digest: `sha256:${string}`; size: number } {
  const code = "REGISTRY_INDEX_INVALID" as const;
  const result = record(value, label, code);
  keys(result, ["location", "digest", "size"], label, code);
  return {
    location: string(result.location, `${label}.location`, code),
    digest: string(result.digest, `${label}.digest`, code, SHA256, 71) as `sha256:${string}`,
    size: positiveInteger(result.size, `${label}.size`, code)
  };
}

function parsePackage(value: unknown, index: number): RegistryIndexPackage {
  const code = "REGISTRY_INDEX_INVALID" as const;
  const label = `packages[${index}]`;
  const result = record(value, label, code);
  keys(result, [
    "namespace", "name", "version", "description", "tags", "source", "manifest", "artifact",
    "published_at", "minimum_dokion_version", "deprecation", "revocation", "provenance_location",
    "signature_bundle_location"
  ], label, code);

  const namespace = string(result.namespace, `${label}.namespace`, code, /^[a-z0-9][a-z0-9._-]{0,63}$/, 64);
  const name = string(result.name, `${label}.name`, code, /^[a-z0-9][a-z0-9._-]{0,127}$/, 128);
  const version = string(result.version, `${label}.version`, code, undefined, 256);
  parseExactPackageReference(`${namespace}/${name}@${version}`);

  const sourceValue = record(result.source, `${label}.source`, code);
  keys(sourceValue, ["transport", "location", "immutable_revision"], `${label}.source`, code);
  const sourceTransport = transport(sourceValue.transport, `${label}.source.transport`, code);
  const sourceRevision = optionalString(sourceValue.immutable_revision, `${label}.source.immutable_revision`, code, GIT_COMMIT, 40);
  if (sourceTransport === "git" && !sourceRevision) fail(code, "Git package sources require an immutable revision.", { index });
  if (sourceTransport !== "git" && sourceRevision) fail(code, "Only Git package sources may declare an immutable revision.", { index });

  let tags: string[] | undefined;
  if (result.tags !== undefined) {
    if (!Array.isArray(result.tags) || result.tags.some((tag) => typeof tag !== "string" || !TAG.test(tag))) {
      fail(code, `${label}.tags is invalid.`, { field: `${label}.tags` });
    }
    tags = result.tags as string[];
    if (new Set(tags).size !== tags.length) fail(code, `${label}.tags contains duplicates.`, { field: `${label}.tags` });
  }

  const deprecationValue = record(result.deprecation, `${label}.deprecation`, code);
  keys(deprecationValue, ["state", "reason", "replacement"], `${label}.deprecation`, code);
  if (deprecationValue.state !== "CURRENT" && deprecationValue.state !== "DEPRECATED") {
    fail(code, `${label}.deprecation.state is invalid.`, { field: `${label}.deprecation.state` });
  }
  const replacement = optionalString(deprecationValue.replacement, `${label}.deprecation.replacement`, code, PACKAGE_ID, 193);

  const revocationValue = record(result.revocation, `${label}.revocation`, code);
  keys(revocationValue, ["state", "reason", "revoked_at"], `${label}.revocation`, code);
  if (revocationValue.state !== "CLEAR" && revocationValue.state !== "REVOKED" && revocationValue.state !== "UNKNOWN") {
    fail(code, `${label}.revocation.state is invalid.`, { field: `${label}.revocation.state` });
  }
  const revokedAt = revocationValue.revoked_at === undefined ? undefined : timestamp(revocationValue.revoked_at, `${label}.revocation.revoked_at`, code);

  return {
    namespace,
    name,
    version,
    ...(result.description === undefined ? {} : { description: string(result.description, `${label}.description`, code, undefined, 1000) }),
    ...(tags ? { tags } : {}),
    source: {
      transport: sourceTransport,
      location: string(sourceValue.location, `${label}.source.location`, code),
      ...(sourceRevision ? { immutable_revision: sourceRevision } : {})
    },
    manifest: parseLocationDigest(result.manifest, `${label}.manifest`),
    artifact: parseLocationDigest(result.artifact, `${label}.artifact`),
    published_at: timestamp(result.published_at, `${label}.published_at`, code),
    minimum_dokion_version: string(result.minimum_dokion_version, `${label}.minimum_dokion_version`, code, undefined, 256),
    deprecation: {
      state: deprecationValue.state,
      ...(deprecationValue.reason === undefined ? {} : { reason: string(deprecationValue.reason, `${label}.deprecation.reason`, code, undefined, 1000) }),
      ...(replacement ? { replacement } : {})
    },
    revocation: {
      state: revocationValue.state,
      ...(revocationValue.reason === undefined ? {} : { reason: string(revocationValue.reason, `${label}.revocation.reason`, code, undefined, 1000) }),
      ...(revokedAt ? { revoked_at: revokedAt } : {})
    },
    ...(result.provenance_location === undefined ? {} : { provenance_location: string(result.provenance_location, `${label}.provenance_location`, code) }),
    ...(result.signature_bundle_location === undefined ? {} : { signature_bundle_location: string(result.signature_bundle_location, `${label}.signature_bundle_location`, code) })
  };
}

export function parseRegistryIndex(bytes: Uint8Array, now = new Date()): RegistryIndexDocument {
  const code = "REGISTRY_INDEX_INVALID" as const;
  const value = record(json(bytes, "Registry Index", code), "Registry Index", code);
  keys(value, ["schema", "source_id", "generated_at", "expires_at", "packages", "authority"], "Registry Index", code);
  if (value.schema !== "dokion.registry-index.v1") fail(code, "Unsupported Registry Index schema.", { schema: value.schema });
  const generatedAt = timestamp(value.generated_at, "generated_at", code);
  const expiresAt = timestamp(value.expires_at, "expires_at", code);
  requireFresh(generatedAt, expiresAt, code, now);
  if (!Array.isArray(value.packages)) fail(code, "Registry Index packages must be an array.", { field: "packages" });
  const packages = value.packages.map(parsePackage);
  const identities = new Set<string>();
  for (const entry of packages) {
    const identity = `${entry.namespace}/${entry.name}@${entry.version}`;
    if (identities.has(identity)) {
      throw new DokionError("REGISTRY_PACKAGE_AMBIGUOUS", `Registry Index contains duplicate package identity: ${identity}`, { identity });
    }
    identities.add(identity);
  }
  return {
    schema: "dokion.registry-index.v1",
    source_id: string(value.source_id, "source_id", code, SOURCE_ID, 128),
    generated_at: generatedAt,
    expires_at: expiresAt,
    packages,
    authority: authority(value.authority, "authority", code)
  };
}
