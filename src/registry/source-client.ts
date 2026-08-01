import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { DokionError, type DokionErrorCode } from "../core/errors.ts";
import {
  fetchVerifiedHttpsBytes,
  readVerifiedLocalBytes,
  type RegistryNetworkTransport,
  type RegistryRetrievalEvidence
} from "./artifact-fetcher.ts";
import { sha256Digest } from "./digests.ts";
import {
  parseRegistryIndex,
  parseRegistryRoot,
  type RegistryIndexPackage,
  type RegistryRootDocument
} from "./registry-documents.ts";
import {
  assertSafeHttpsUrl,
  parseExactPackageReference,
  parseRegistryConfig,
  selectRegistrySource,
  type ExactPackageReference,
  type GitRegistrySource,
  type RegistryConfig,
  type RegistryNetworkPolicy,
  type RegistrySource
} from "./source-policy.ts";

const CONFIG_MAXIMUM_BYTES = 4 * 1024 * 1024;
const GIT_DIAGNOSTIC_MAXIMUM_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

export interface RetrieveRegistryPackageOptions {
  configPath: string;
  source: string;
  packageReference: string;
  networkTransport?: RegistryNetworkTransport;
  timeoutMs?: number;
  now?: Date;
}

export interface RegistrySourceEvidence {
  id: string;
  name: string;
  transport: "local" | "https" | "git";
}

export interface RetrievedRegistryPackage {
  config: RegistryConfig;
  source: RegistrySource;
  sourceEvidence: RegistrySourceEvidence;
  packageReference: ExactPackageReference;
  packageEntry: RegistryIndexPackage;
  indexDigest: `sha256:${string}`;
  indexSize: number;
  artifactBytes: Uint8Array;
  artifactDigest: `sha256:${string}`;
  artifactSize: number;
  retrieval: {
    transport: "local" | "https" | "git";
    redirects: number;
  };
}

interface ObjectReadResult {
  bytes: Uint8Array;
  digest: `sha256:${string}`;
  size: number;
  networkEvidence?: RegistryRetrievalEvidence;
}

interface RegistryObjectReader {
  readRoot(): Promise<ObjectReadResult>;
  read(
    location: string,
    expected: { digest: `sha256:${string}`; size: number },
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult>;
  validateRoot(root: RegistryRootDocument): void;
  validatePackage(entry: RegistryIndexPackage): void;
  close(): Promise<void>;
}

function parseJson(bytes: Uint8Array, label: string): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    throw new DokionError("REGISTRY_CONFIG_INVALID", `${label} must contain valid UTF-8 JSON.`, {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function safeRelativeLocation(value: string, label: string): string {
  if (
    value.length === 0 ||
    value.length > 2048 ||
    isAbsolute(value) ||
    value.includes("\0") ||
    value.includes("\\") ||
    value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new DokionError("REGISTRY_SOURCE_MISMATCH", `${label} must be a normalized relative location.`, {
      label
    });
  }
  return value;
}

function within(base: string, location: string, label: string): string {
  const target = resolve(base, ...safeRelativeLocation(location, label).split("/"));
  const path = relative(base, target);
  if (path === "" || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
    throw new DokionError("REGISTRY_SOURCE_MISMATCH", `${label} escapes the selected Registry source.`, {
      label
    });
  }
  return target;
}

function sourceIdentity(root: RegistryRootDocument, source: RegistrySource): void {
  if (root.source.id !== source.id || root.source.name !== source.name || root.source.transport !== source.transport) {
    throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry Root identity does not match the selected source.", {
      expectedId: source.id,
      observedId: root.source.id,
      expectedTransport: source.transport,
      observedTransport: root.source.transport
    });
  }
}

class LocalObjectReader implements RegistryObjectReader {
  readonly #base: string;

  constructor(
    private readonly source: Extract<RegistrySource, { transport: "local" }>,
    configDirectory: string,
    private readonly policy: RegistryNetworkPolicy
  ) {
    this.#base = isAbsolute(source.path) ? resolve(source.path) : resolve(configDirectory, source.path);
  }

  async readRoot(): Promise<ObjectReadResult> {
    return this.#readPath("root.json", undefined, {
      digest: "REGISTRY_DOCUMENT_INVALID",
      size: "REGISTRY_DOCUMENT_INVALID"
    });
  }

  async read(
    location: string,
    expected: { digest: `sha256:${string}`; size: number },
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult> {
    return this.#readPath(location, expected, mismatch);
  }

  async #readPath(
    location: string,
    expected: { digest: `sha256:${string}`; size: number } | undefined,
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult> {
    const result = await readVerifiedLocalBytes({
      path: within(this.#base, location, "Registry local object location"),
      maximumBytes: this.policy.maximum_response_bytes,
      ...(expected ? { expectedDigest: expected.digest, expectedSize: expected.size } : {}),
      digestMismatchCode: mismatch.digest,
      sizeMismatchCode: mismatch.size
    });
    return result;
  }

  validateRoot(root: RegistryRootDocument): void {
    sourceIdentity(root, this.source);
    if (safeRelativeLocation(root.source.location, "Registry Root source.location") !== "root.json") {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Local Registry Root must identify root.json as its source location.");
    }
    if (root.source.immutable_revision) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Local Registry Root may not declare a Git revision.");
    }
  }

  validatePackage(entry: RegistryIndexPackage): void {
    if (entry.source.transport !== "local") {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry package transport does not match the selected local source.");
    }
    safeRelativeLocation(entry.source.location, "package.source.location");
    safeRelativeLocation(entry.manifest.location, "package.manifest.location");
    safeRelativeLocation(entry.artifact.location, "package.artifact.location");
  }

  async close(): Promise<void> {}
}

class HttpsObjectReader implements RegistryObjectReader {
  readonly #rootUrl: URL;

  constructor(
    private readonly source: Extract<RegistrySource, { transport: "https" }>,
    private readonly policy: RegistryNetworkPolicy,
    private readonly timeoutMs: number,
    private readonly networkTransport?: RegistryNetworkTransport
  ) {
    this.#rootUrl = assertSafeHttpsUrl(source.url, policy, "Registry HTTPS source");
  }

  async readRoot(): Promise<ObjectReadResult> {
    const result = await fetchVerifiedHttpsBytes({
      url: this.#rootUrl.href,
      policy: this.policy,
      timeoutMs: this.timeoutMs,
      ...(this.networkTransport ? { transport: this.networkTransport } : {})
    });
    return {
      bytes: result.bytes,
      digest: result.evidence.digest,
      size: result.evidence.size,
      networkEvidence: result.evidence
    };
  }

  async read(
    location: string,
    expected: { digest: `sha256:${string}`; size: number },
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult> {
    const url = this.#sameOrigin(location, "Registry HTTPS object location");
    const result = await fetchVerifiedHttpsBytes({
      url: url.href,
      expectedDigest: expected.digest,
      expectedSize: expected.size,
      policy: this.policy,
      timeoutMs: this.timeoutMs,
      digestMismatchCode: mismatch.digest,
      sizeMismatchCode: mismatch.size,
      ...(this.networkTransport ? { transport: this.networkTransport } : {})
    });
    return {
      bytes: result.bytes,
      digest: result.evidence.digest,
      size: result.evidence.size,
      networkEvidence: result.evidence
    };
  }

  #sameOrigin(location: string, label: string): URL {
    const url = assertSafeHttpsUrl(location, this.policy, label);
    if (url.origin !== this.#rootUrl.origin) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", `${label} must remain on the selected Registry origin.`, {
        expectedOrigin: this.#rootUrl.origin,
        observedOrigin: url.origin
      });
    }
    return url;
  }

  validateRoot(root: RegistryRootDocument): void {
    sourceIdentity(root, this.source);
    const location = this.#sameOrigin(root.source.location, "Registry Root source.location");
    if (location.href !== this.#rootUrl.href) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry Root location does not match the explicitly selected HTTPS source.");
    }
    if (root.source.immutable_revision) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "HTTPS Registry Root may not declare a Git revision.");
    }
  }

  validatePackage(entry: RegistryIndexPackage): void {
    if (entry.source.transport !== "https") {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry package transport does not match the selected HTTPS source.");
    }
    this.#sameOrigin(entry.source.location, "package.source.location");
    this.#sameOrigin(entry.manifest.location, "package.manifest.location");
    this.#sameOrigin(entry.artifact.location, "package.artifact.location");
  }

  async close(): Promise<void> {}
}

async function readStreamBounded(stream: ReadableStream<Uint8Array>, maximumBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!result.value) continue;
      size += result.value.length;
      if (size > maximumBytes) {
        throw new DokionError("REGISTRY_RESPONSE_TOO_LARGE", "Git Registry object exceeds the configured size bound.", {
          maximumBytes,
          observedSize: size
        });
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
}

async function runGit(
  cwd: string,
  args: string[],
  maximumStdoutBytes: number,
  timeoutMs: number
): Promise<Uint8Array> {
  const process = Bun.spawn({
    cmd: ["git", ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...globalThis.process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: "/bin/false"
    }
  });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      process.kill();
      reject(new DokionError("REGISTRY_SOURCE_TIMEOUT", "Git Registry operation timed out.", { timeoutMs }));
    }, timeoutMs);
  });
  try {
    const stdoutPromise = readStreamBounded(process.stdout, maximumStdoutBytes);
    const stderrPromise = readStreamBounded(process.stderr, GIT_DIAGNOSTIC_MAXIMUM_BYTES).catch(() => new Uint8Array());
    const exitCode = await Promise.race([process.exited, timeout]);
    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
    if (exitCode !== 0) {
      throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Git Registry operation failed.", {
        exitCode,
        diagnostic: new TextDecoder().decode(stderr).slice(0, 1000)
      });
    }
    return stdout;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

class GitObjectReader implements RegistryObjectReader {
  private constructor(
    private readonly source: GitRegistrySource,
    private readonly policy: RegistryNetworkPolicy,
    private readonly timeoutMs: number,
    private readonly directory: string,
    private readonly rootDirectory: string
  ) {}

  static async open(source: GitRegistrySource, policy: RegistryNetworkPolicy, timeoutMs: number): Promise<GitObjectReader> {
    assertSafeHttpsUrl(source.url, policy, "Registry Git source");
    const directory = await mkdtemp(resolve(tmpdir(), "dokion-registry-git-"));
    try {
      await runGit(directory, ["init", "--quiet"], GIT_DIAGNOSTIC_MAXIMUM_BYTES, timeoutMs);
      await runGit(
        directory,
        ["-c", "credential.helper=", "fetch", "--quiet", "--depth=1", "--filter=blob:none", source.url, source.immutable_revision],
        GIT_DIAGNOSTIC_MAXIMUM_BYTES,
        timeoutMs
      );
      const observed = new TextDecoder().decode(
        await runGit(directory, ["rev-parse", "FETCH_HEAD"], GIT_DIAGNOSTIC_MAXIMUM_BYTES, timeoutMs)
      ).trim();
      if (observed !== source.immutable_revision) {
        throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Git Registry fetch did not resolve to the configured immutable revision.", {
          expectedRevision: source.immutable_revision,
          observedRevision: observed
        });
      }
      return new GitObjectReader(source, policy, timeoutMs, directory, dirname(source.root_path).replaceAll("\\", "/"));
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async readRoot(): Promise<ObjectReadResult> {
    return this.#readPath(this.source.root_path, undefined, {
      digest: "REGISTRY_DOCUMENT_INVALID",
      size: "REGISTRY_DOCUMENT_INVALID"
    });
  }

  async read(
    location: string,
    expected: { digest: `sha256:${string}`; size: number },
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult> {
    const rooted = this.rootDirectory === "." ? safeRelativeLocation(location, "Git Registry object location") : `${this.rootDirectory}/${safeRelativeLocation(location, "Git Registry object location")}`;
    return this.#readPath(rooted, expected, mismatch);
  }

  async #readPath(
    path: string,
    expected: { digest: `sha256:${string}`; size: number } | undefined,
    mismatch: { digest: DokionErrorCode; size: DokionErrorCode }
  ): Promise<ObjectReadResult> {
    safeRelativeLocation(path, "Git Registry path");
    const bytes = await runGit(
      this.directory,
      ["show", `FETCH_HEAD:${path}`],
      this.policy.maximum_response_bytes,
      this.timeoutMs
    );
    const observedDigest = sha256Digest(bytes);
    if (expected && bytes.length !== expected.size) {
      throw new DokionError(mismatch.size, "Git Registry object size does not match the expected size.", {
        expectedSize: expected.size,
        observedSize: bytes.length
      });
    }
    if (expected && observedDigest !== expected.digest) {
      throw new DokionError(mismatch.digest, "Git Registry object digest does not match the expected digest.", {
        expectedDigest: expected.digest,
        observedDigest
      });
    }
    return { bytes, size: bytes.length, digest: observedDigest };
  }

  validateRoot(root: RegistryRootDocument): void {
    sourceIdentity(root, this.source);
    if (root.source.location !== this.source.url || root.source.immutable_revision !== this.source.immutable_revision) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Git Registry Root does not match the configured repository and revision.");
    }
  }

  validatePackage(entry: RegistryIndexPackage): void {
    if (
      entry.source.transport !== "git" ||
      entry.source.location !== this.source.url ||
      entry.source.immutable_revision !== this.source.immutable_revision
    ) {
      throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry package does not match the selected immutable Git source.");
    }
    safeRelativeLocation(entry.manifest.location, "package.manifest.location");
    safeRelativeLocation(entry.artifact.location, "package.artifact.location");
  }

  async close(): Promise<void> {
    await rm(this.directory, { recursive: true, force: true });
  }
}

async function loadConfig(configPath: string): Promise<RegistryConfig> {
  const result = await readVerifiedLocalBytes({
    path: resolve(configPath),
    maximumBytes: CONFIG_MAXIMUM_BYTES
  });
  return parseRegistryConfig(parseJson(result.bytes, "Registry Config"));
}

async function readerFor(
  source: RegistrySource,
  configDirectory: string,
  policy: RegistryNetworkPolicy,
  timeoutMs: number,
  networkTransport?: RegistryNetworkTransport
): Promise<RegistryObjectReader> {
  if (source.transport === "local") return new LocalObjectReader(source, configDirectory, policy);
  if (source.transport === "https") return new HttpsObjectReader(source, policy, timeoutMs, networkTransport);
  return GitObjectReader.open(source, policy, timeoutMs);
}

function selectPackage(
  packages: RegistryIndexPackage[],
  reference: ExactPackageReference
): RegistryIndexPackage {
  const matches = packages.filter(
    (entry) => entry.namespace === reference.namespace && entry.name === reference.name && entry.version === reference.version
  );
  if (matches.length === 0) {
    throw new DokionError("REGISTRY_PACKAGE_NOT_FOUND", `Registry package was not found: ${reference.packageId}@${reference.version}`, {
      packageId: reference.packageId,
      version: reference.version
    });
  }
  if (matches.length !== 1) {
    throw new DokionError("REGISTRY_PACKAGE_AMBIGUOUS", `Registry package has multiple authoritative index entries: ${reference.packageId}@${reference.version}`, {
      packageId: reference.packageId,
      version: reference.version,
      matches: matches.length
    });
  }
  const entry = matches[0]!;
  if (entry.revocation.state !== "CLEAR") {
    throw new DokionError("REGISTRY_INDEX_INVALID", "Registry package revocation state does not permit retrieval.", {
      packageId: reference.packageId,
      version: reference.version,
      revocationState: entry.revocation.state
    });
  }
  return entry;
}

export async function retrieveRegistryPackage(
  options: RetrieveRegistryPackageOptions
): Promise<RetrievedRegistryPackage> {
  const configPath = resolve(options.configPath);
  const config = await loadConfig(configPath);
  const source = selectRegistrySource(config, options.source);
  const packageReference = parseExactPackageReference(options.packageReference);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const reader = await readerFor(
    source,
    dirname(configPath),
    config.network_policy,
    timeoutMs,
    options.networkTransport
  );

  try {
    const rootResult = await reader.readRoot();
    const root = parseRegistryRoot(rootResult.bytes, options.now);
    reader.validateRoot(root);

    const matchingPackages: RegistryIndexPackage[] = [];
    let matchingIndexDigest: `sha256:${string}` | undefined;
    let matchingIndexSize: number | undefined;
    for (const indexReference of root.indexes) {
      if (source.transport === "git" && indexReference.immutable_revision !== source.immutable_revision) {
        throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry Root index revision does not match the selected Git source.");
      }
      const indexResult = await reader.read(indexReference.location, indexReference, {
        digest: "REGISTRY_INDEX_DIGEST_MISMATCH",
        size: "REGISTRY_INDEX_SIZE_MISMATCH"
      });
      const index = parseRegistryIndex(indexResult.bytes, options.now);
      if (index.source_id !== source.id) {
        throw new DokionError("REGISTRY_SOURCE_MISMATCH", "Registry Index source ID does not match the selected source.", {
          expectedId: source.id,
          observedId: index.source_id
        });
      }
      const matches = index.packages.filter(
        (entry) =>
          entry.namespace === packageReference.namespace &&
          entry.name === packageReference.name &&
          entry.version === packageReference.version
      );
      if (matches.length > 0) {
        matchingPackages.push(...matches);
        matchingIndexDigest = indexResult.digest;
        matchingIndexSize = indexResult.size;
      }
    }

    const packageEntry = selectPackage(matchingPackages, packageReference);
    reader.validatePackage(packageEntry);
    const artifact = await reader.read(packageEntry.artifact.location, packageEntry.artifact, {
      digest: "REGISTRY_ARTIFACT_DIGEST_MISMATCH",
      size: "REGISTRY_ARTIFACT_SIZE_MISMATCH"
    });

    return {
      config,
      source,
      sourceEvidence: { id: source.id, name: source.name, transport: source.transport },
      packageReference,
      packageEntry,
      indexDigest: matchingIndexDigest!,
      indexSize: matchingIndexSize!,
      artifactBytes: artifact.bytes,
      artifactDigest: artifact.digest,
      artifactSize: artifact.size,
      retrieval: {
        transport: source.transport,
        redirects: artifact.networkEvidence?.redirects ?? 0
      }
    };
  } finally {
    await reader.close();
  }
}
