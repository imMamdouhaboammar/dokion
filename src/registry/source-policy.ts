import { isIP } from "node:net";

import { DokionError } from "../core/errors.ts";

const SOURCE_ID = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SOURCE_NAME = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;
const PACKAGE_NAMESPACE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const PACKAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const EXACT_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const GIT_COMMIT = /^[a-f0-9]{40}$/;

export interface RegistryAuthorityNone {
  selection_authority: false;
  substitution_authority: false;
  installation_authority: false;
  activation_authority: false;
  execution_authority: false;
}

export interface RegistryNetworkPolicy {
  https_only: true;
  allow_private_networks: boolean;
  maximum_redirects: number;
  maximum_response_bytes: number;
}

interface RegistrySourceBase {
  name: string;
  id: string;
  priority: number;
  enabled: boolean;
  cache_ttl_seconds: number;
}

export interface LocalRegistrySource extends RegistrySourceBase {
  transport: "local";
  path: string;
}

export interface HttpsRegistrySource extends RegistrySourceBase {
  transport: "https";
  url: string;
}

export interface GitRegistrySource extends RegistrySourceBase {
  transport: "git";
  url: string;
  immutable_revision: string;
  root_path: string;
}

export type RegistrySource = LocalRegistrySource | HttpsRegistrySource | GitRegistrySource;

export interface RegistryConfig {
  schema: "dokion.registry-config.v1";
  scope: "global" | "project";
  revision: number;
  sources: RegistrySource[];
  network_policy: RegistryNetworkPolicy;
  authority: RegistryAuthorityNone;
}

export interface ExactPackageReference {
  packageId: string;
  namespace: string;
  name: string;
  version: string;
}

type JsonRecord = Record<string, unknown>;

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new DokionError("REGISTRY_CONFIG_INVALID", message, details);
}

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalid(`${label} must be an object.`, { field: label });
  }
  return value as JsonRecord;
}

function exactKeys(value: JsonRecord, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  if (unknown.length > 0) invalid(`${label} contains unsupported fields.`, { field: label, fields: unknown });
}

function requiredString(value: unknown, label: string, pattern?: RegExp): string {
  if (typeof value !== "string" || value.length === 0 || (pattern && !pattern.test(value))) {
    invalid(`${label} is invalid.`, { field: label });
  }
  return value;
}

function requiredInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid(`${label} must be an integer from ${minimum} to ${maximum}.`, { field: label, value });
  }
  return value as number;
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") invalid(`${label} must be a boolean.`, { field: label });
  return value;
}

function parseAuthority(value: unknown, label = "authority"): RegistryAuthorityNone {
  const authority = record(value, label);
  const keys = [
    "selection_authority",
    "substitution_authority",
    "installation_authority",
    "activation_authority",
    "execution_authority"
  ] as const;
  exactKeys(authority, keys, label);
  for (const key of keys) {
    if (authority[key] !== false) {
      invalid(`${label}.${key} must be false.`, { field: `${label}.${key}`, value: authority[key] });
    }
  }
  return {
    selection_authority: false,
    substitution_authority: false,
    installation_authority: false,
    activation_authority: false,
    execution_authority: false
  };
}

function parseNetworkPolicy(value: unknown): RegistryNetworkPolicy {
  const policy = record(value, "network_policy");
  exactKeys(
    policy,
    ["https_only", "allow_private_networks", "maximum_redirects", "maximum_response_bytes"],
    "network_policy"
  );
  if (policy.https_only !== true) invalid("network_policy.https_only must be true.", { field: "network_policy.https_only" });
  return {
    https_only: true,
    allow_private_networks: requiredBoolean(policy.allow_private_networks, "network_policy.allow_private_networks"),
    maximum_redirects: requiredInteger(policy.maximum_redirects, "network_policy.maximum_redirects", 0, 10),
    maximum_response_bytes: requiredInteger(
      policy.maximum_response_bytes,
      "network_policy.maximum_response_bytes",
      1024,
      104_857_600
    )
  };
}

function sourceBase(source: JsonRecord, index: number): RegistrySourceBase {
  const label = `sources[${index}]`;
  return {
    name: requiredString(source.name, `${label}.name`, SOURCE_NAME),
    id: requiredString(source.id, `${label}.id`, SOURCE_ID),
    priority: requiredInteger(source.priority, `${label}.priority`, 0, 1_000_000),
    enabled: requiredBoolean(source.enabled, `${label}.enabled`),
    cache_ttl_seconds: requiredInteger(source.cache_ttl_seconds, `${label}.cache_ttl_seconds`, 0, 2_592_000)
  };
}

function parseSource(value: unknown, index: number, policy: RegistryNetworkPolicy): RegistrySource {
  const label = `sources[${index}]`;
  const source = record(value, label);
  const transport = requiredString(source.transport, `${label}.transport`);
  const baseKeys = ["name", "id", "priority", "enabled", "cache_ttl_seconds", "transport"];
  const base = sourceBase(source, index);

  if (transport === "local") {
    exactKeys(source, [...baseKeys, "path"], label);
    const path = requiredString(source.path, `${label}.path`);
    if (path.includes("\0")) invalid(`${label}.path contains a NUL byte.`, { field: `${label}.path` });
    return { ...base, transport, path };
  }

  if (transport === "https") {
    exactKeys(source, [...baseKeys, "url"], label);
    const url = assertSafeHttpsUrl(requiredString(source.url, `${label}.url`), policy, `${label}.url`).href;
    return { ...base, transport, url };
  }

  if (transport === "git") {
    exactKeys(source, [...baseKeys, "url", "immutable_revision", "root_path"], label);
    const url = assertSafeHttpsUrl(requiredString(source.url, `${label}.url`), policy, `${label}.url`).href;
    const immutableRevision = requiredString(source.immutable_revision, `${label}.immutable_revision`, GIT_COMMIT);
    const rootPath = requiredString(source.root_path, `${label}.root_path`);
    if (
      rootPath.startsWith("/") ||
      rootPath.includes("\\") ||
      rootPath.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ) {
      invalid(`${label}.root_path must be a normalized relative path.`, { field: `${label}.root_path` });
    }
    return {
      ...base,
      transport,
      url,
      immutable_revision: immutableRevision,
      root_path: rootPath
    };
  }

  invalid(`${label}.transport is not supported by Registry v1.`, { field: `${label}.transport`, transport });
}

export function parseRegistryConfig(value: unknown): RegistryConfig {
  const config = record(value, "Registry Config");
  exactKeys(config, ["schema", "scope", "revision", "sources", "network_policy", "authority"], "Registry Config");
  if (config.schema !== "dokion.registry-config.v1") {
    invalid("Unsupported Registry Config schema.", { field: "schema", schema: config.schema });
  }
  if (config.scope !== "global" && config.scope !== "project") {
    invalid("Registry Config scope must be global or project.", { field: "scope", scope: config.scope });
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    invalid("Registry Config must contain at least one source.", { field: "sources" });
  }

  const networkPolicy = parseNetworkPolicy(config.network_policy);
  const sources = config.sources.map((source, index) => parseSource(source, index, networkPolicy));
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const source of sources) {
    if (names.has(source.name)) invalid(`Duplicate Registry source name: ${source.name}`, { field: "sources.name", name: source.name });
    if (ids.has(source.id)) invalid(`Duplicate Registry source ID: ${source.id}`, { field: "sources.id", id: source.id });
    names.add(source.name);
    ids.add(source.id);
  }

  return {
    schema: "dokion.registry-config.v1",
    scope: config.scope,
    revision: requiredInteger(config.revision, "revision", 1, Number.MAX_SAFE_INTEGER),
    sources,
    network_policy: networkPolicy,
    authority: parseAuthority(config.authority)
  };
}

export function selectRegistrySource(config: RegistryConfig, selector: string): RegistrySource {
  const source = config.sources.find((candidate) => candidate.name === selector || candidate.id === selector);
  if (!source) {
    throw new DokionError("REGISTRY_SOURCE_NOT_FOUND", `Registry source was not found: ${selector}`, { selector });
  }
  if (!source.enabled) {
    throw new DokionError("REGISTRY_SOURCE_DISABLED", `Registry source is disabled: ${source.name}`, {
      source: source.name,
      sourceId: source.id
    });
  }
  return source;
}

function privateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIpv6(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (/^f[cd]/.test(value) || /^fe[89ab]/.test(value)) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  return mapped ? privateIpv4(mapped[1]!) : false;
}

export function isPrivateRegistryHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }
  const family = isIP(normalized);
  if (family === 4) return privateIpv4(normalized);
  if (family === 6) return privateIpv6(normalized);
  return false;
}

export function assertSafeHttpsUrl(value: string, policy: RegistryNetworkPolicy, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DokionError("REGISTRY_SOURCE_URL_INVALID", `${label} must be a valid HTTPS URL.`, { label });
  }
  if (
    url.protocol !== "https:" ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0 ||
    url.search.length > 0
  ) {
    throw new DokionError(
      "REGISTRY_SOURCE_URL_INVALID",
      `${label} must use HTTPS without credentials, fragments, or query parameters.`,
      { label, protocol: url.protocol }
    );
  }
  if (!policy.allow_private_networks && isPrivateRegistryHostname(url.hostname)) {
    throw new DokionError("REGISTRY_SOURCE_URL_INVALID", `${label} may not target a private or local network.`, {
      label,
      hostname: url.hostname
    });
  }
  return url;
}

export function parseExactPackageReference(value: string): ExactPackageReference {
  const separator = value.lastIndexOf("@");
  const packageId = separator > 0 ? value.slice(0, separator) : "";
  const version = separator > 0 ? value.slice(separator + 1) : "";
  const slash = packageId.indexOf("/");
  const namespace = slash > 0 ? packageId.slice(0, slash) : "";
  const name = slash > 0 ? packageId.slice(slash + 1) : "";
  if (
    packageId.indexOf("/", slash + 1) !== -1 ||
    !PACKAGE_NAMESPACE.test(namespace) ||
    !PACKAGE_NAME.test(name) ||
    !EXACT_SEMVER.test(version)
  ) {
    throw new DokionError(
      "REGISTRY_PACKAGE_REFERENCE_INVALID",
      "Registry package references must use namespace/name@exact-version.",
      { reference: value }
    );
  }
  return { packageId, namespace, name, version };
}
