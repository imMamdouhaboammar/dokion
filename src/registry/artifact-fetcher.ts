import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { DokionError, type DokionErrorCode } from "../core/errors.ts";
import {
  assertSafeHttpsUrl,
  isPrivateRegistryHostname,
  type RegistryNetworkPolicy
} from "./source-policy.ts";

export interface RegistryNetworkResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: AsyncIterable<Uint8Array>;
}

export interface RegistryNetworkTransport {
  request(
    url: string,
    options: { signal: AbortSignal; headers: Readonly<Record<string, string>> }
  ): Promise<RegistryNetworkResponse>;
}

export interface RegistryRetrievalEvidence {
  initialUrl: string;
  finalUrl: string;
  redirects: number;
  size: number;
  digest: `sha256:${string}`;
  contentType?: string;
}

export interface VerifiedBytesResult {
  bytes: Uint8Array;
  evidence: RegistryRetrievalEvidence;
}

export interface FetchVerifiedHttpsBytesOptions {
  url: string;
  expectedDigest?: `sha256:${string}`;
  expectedSize?: number;
  policy: RegistryNetworkPolicy;
  timeoutMs: number;
  transport?: RegistryNetworkTransport;
  digestMismatchCode?: DokionErrorCode;
  sizeMismatchCode?: DokionErrorCode;
}

export interface ReadVerifiedLocalBytesOptions {
  path: string;
  maximumBytes: number;
  expectedDigest?: `sha256:${string}`;
  expectedSize?: number;
  digestMismatchCode?: DokionErrorCode;
  sizeMismatchCode?: DokionErrorCode;
}

function normalizedHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

function responseBody(body: ReadableStream<Uint8Array> | null): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      if (!body) return;
      const reader = body.getReader();
      try {
        while (true) {
          const result = await reader.read();
          if (result.done) return;
          if (result.value) yield result.value;
        }
      } finally {
        reader.releaseLock();
      }
    }
  };
}

export const DEFAULT_REGISTRY_NETWORK_TRANSPORT: RegistryNetworkTransport = Object.freeze({
  async request(
    url: string,
    options: { signal: AbortSignal; headers: Readonly<Record<string, string>> }
  ): Promise<RegistryNetworkResponse> {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      signal: options.signal,
      headers: options.headers
    });
    return {
      status: response.status,
      headers: normalizedHeaders(response.headers),
      body: responseBody(response.body)
    };
  }
});

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function positiveExpectedSize(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DokionError("REGISTRY_ARTIFACT_SIZE_MISMATCH", "Expected Registry byte size is invalid.", {
      expectedSize: value
    });
  }
  return value;
}

async function assertPublicDnsTarget(url: URL, policy: RegistryNetworkPolicy): Promise<void> {
  if (policy.allow_private_networks || isPrivateRegistryHostname(url.hostname)) return;
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Registry source hostname could not be resolved.", {
      hostname: url.hostname,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateRegistryHostname(entry.address))) {
    throw new DokionError("REGISTRY_SOURCE_URL_INVALID", "Registry source resolved to a private or local network.", {
      hostname: url.hostname
    });
  }
}

function header(response: RegistryNetworkResponse, name: string): string | undefined {
  return response.headers[name] ?? response.headers[name.toLowerCase()];
}

function parseContentLength(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new DokionError("REGISTRY_ARTIFACT_SIZE_MISMATCH", "Registry response contains an invalid Content-Length header.", {
      contentLength: value
    });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DokionError("REGISTRY_ARTIFACT_SIZE_MISMATCH", "Registry response Content-Length exceeds the safe integer range.");
  }
  return parsed;
}

function redirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function requestWithTimeout(
  transport: RegistryNetworkTransport,
  url: string,
  signal: AbortSignal,
  timeoutMs: number
): Promise<RegistryNetworkResponse> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new DokionError("REGISTRY_SOURCE_TIMEOUT", "Registry source request timed out.", { timeoutMs }));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      transport.request(url, { signal, headers: { accept: "application/octet-stream" } }),
      timeout
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function fetchVerifiedHttpsBytes(
  options: FetchVerifiedHttpsBytesOptions
): Promise<VerifiedBytesResult> {
  const transport = options.transport ?? DEFAULT_REGISTRY_NETWORK_TRANSPORT;
  const expectedSize = positiveExpectedSize(options.expectedSize);
  const maximumBytes = options.policy.maximum_response_bytes;
  if (expectedSize !== undefined && expectedSize > maximumBytes) {
    throw new DokionError("REGISTRY_RESPONSE_TOO_LARGE", "Expected Registry response exceeds the configured size bound.", {
      expectedSize,
      maximumBytes
    });
  }
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new DokionError("REGISTRY_CONFIG_INVALID", "Registry request timeout must be a positive integer.", {
      timeoutMs: options.timeoutMs
    });
  }

  const initial = assertSafeHttpsUrl(options.url, options.policy, "Registry URL");
  let current = initial;
  let redirects = 0;
  const visited = new Set<string>();
  const controller = new AbortController();

  try {
    while (true) {
      if (visited.has(current.href)) {
        throw new DokionError("REGISTRY_REDIRECT_LOOP", "Registry redirect loop detected.", {
          redirects
        });
      }
      visited.add(current.href);
      if (transport === DEFAULT_REGISTRY_NETWORK_TRANSPORT) await assertPublicDnsTarget(current, options.policy);

      let response: RegistryNetworkResponse;
      try {
        response = await requestWithTimeout(transport, current.href, controller.signal, options.timeoutMs);
      } catch (error) {
        if (error instanceof DokionError) throw error;
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          throw new DokionError("REGISTRY_SOURCE_TIMEOUT", "Registry source request timed out.", {
            timeoutMs: options.timeoutMs
          });
        }
        throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Registry source request failed.", {
          cause: error instanceof Error ? error.message : String(error)
        });
      }

      if (redirectStatus(response.status)) {
        if (redirects >= options.policy.maximum_redirects) {
          throw new DokionError("REGISTRY_REDIRECT_LIMIT", "Registry redirect limit exceeded.", {
            maximumRedirects: options.policy.maximum_redirects
          });
        }
        const location = header(response, "location");
        if (!location) {
          throw new DokionError("REGISTRY_REDIRECT_INVALID", "Registry redirect did not provide a Location header.", {
            status: response.status
          });
        }
        let next: URL;
        try {
          next = assertSafeHttpsUrl(new URL(location, current).href, options.policy, "Registry redirect");
        } catch (error) {
          if (error instanceof DokionError) {
            throw new DokionError("REGISTRY_REDIRECT_INVALID", "Registry redirect target is not permitted.", {
              cause: error.message
            });
          }
          throw error;
        }
        if (visited.has(next.href)) {
          throw new DokionError("REGISTRY_REDIRECT_LOOP", "Registry redirect loop detected.", {
            redirects: redirects + 1
          });
        }
        current = next;
        redirects += 1;
        continue;
      }

      if (response.status !== 200) {
        throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Registry source returned an unsuccessful HTTP status.", {
          status: response.status
        });
      }

      const contentEncoding = header(response, "content-encoding")?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw new DokionError(
          "REGISTRY_CONTENT_ENCODING_UNSUPPORTED",
          "Registry responses must be delivered without content encoding.",
          { contentEncoding }
        );
      }

      const contentLength = parseContentLength(header(response, "content-length"));
      if (contentLength !== undefined && contentLength > maximumBytes) {
        throw new DokionError("REGISTRY_RESPONSE_TOO_LARGE", "Registry response exceeds the configured size bound.", {
          contentLength,
          maximumBytes
        });
      }
      const sizeMismatchCode = options.sizeMismatchCode ?? "REGISTRY_ARTIFACT_SIZE_MISMATCH";
      if (expectedSize !== undefined && contentLength !== undefined && contentLength !== expectedSize) {
        throw new DokionError(sizeMismatchCode, "Registry response size does not match the expected size.", {
          expectedSize,
          observedSize: contentLength
        });
      }

      const chunks: Uint8Array[] = [];
      const hash = createHash("sha256");
      let observedSize = 0;
      for await (const chunkValue of response.body) {
        const chunk = Uint8Array.from(chunkValue);
        observedSize += chunk.length;
        if (observedSize > maximumBytes) {
          throw new DokionError("REGISTRY_RESPONSE_TOO_LARGE", "Registry response exceeded the configured size bound while streaming.", {
            observedSize,
            maximumBytes
          });
        }
        if (expectedSize !== undefined && observedSize > expectedSize) {
          throw new DokionError(sizeMismatchCode, "Registry response exceeded the expected size while streaming.", {
            expectedSize,
            observedSize
          });
        }
        hash.update(chunk);
        chunks.push(chunk);
      }

      if (expectedSize !== undefined && observedSize !== expectedSize) {
        throw new DokionError(sizeMismatchCode, "Registry response size does not match the expected size.", {
          expectedSize,
          observedSize
        });
      }
      if (contentLength !== undefined && observedSize !== contentLength) {
        throw new DokionError(sizeMismatchCode, "Registry response was truncated or exceeded Content-Length.", {
          expectedSize: contentLength,
          observedSize
        });
      }

      const observedDigest = `sha256:${hash.digest("hex")}` as const;
      const digestMismatchCode = options.digestMismatchCode ?? "REGISTRY_ARTIFACT_DIGEST_MISMATCH";
      if (options.expectedDigest && observedDigest !== options.expectedDigest) {
        throw new DokionError(digestMismatchCode, "Registry response digest does not match the expected digest.", {
          expectedDigest: options.expectedDigest,
          observedDigest
        });
      }

      const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), observedSize);
      const contentType = header(response, "content-type")?.split(";", 1)[0]?.trim();
      return {
        bytes,
        evidence: {
          initialUrl: initial.href,
          finalUrl: current.href,
          redirects,
          size: observedSize,
          digest: observedDigest,
          ...(contentType ? { contentType } : {})
        }
      };
    }
  } finally {
    controller.abort();
  }
}

export async function readVerifiedLocalBytes(
  options: ReadVerifiedLocalBytesOptions
): Promise<{ bytes: Uint8Array; size: number; digest: `sha256:${string}` }> {
  const expectedSize = positiveExpectedSize(options.expectedSize);
  let handle;
  try {
    handle = await open(options.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Registry source file could not be opened safely.", {
      path: options.path,
      errorCode: (error as NodeJS.ErrnoException).code ?? "UNKNOWN",
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1) {
      throw new DokionError("REGISTRY_SOURCE_UNAVAILABLE", "Registry source file must be a single-link regular file.", {
        path: options.path,
        links: stat.nlink
      });
    }
    if (stat.size > options.maximumBytes) {
      throw new DokionError("REGISTRY_RESPONSE_TOO_LARGE", "Registry source file exceeds the configured size bound.", {
        size: stat.size,
        maximumBytes: options.maximumBytes
      });
    }
    const sizeMismatchCode = options.sizeMismatchCode ?? "REGISTRY_ARTIFACT_SIZE_MISMATCH";
    if (expectedSize !== undefined && stat.size !== expectedSize) {
      throw new DokionError(sizeMismatchCode, "Registry source file size does not match the expected size.", {
        expectedSize,
        observedSize: stat.size
      });
    }
    const bytes = await handle.readFile();
    if (bytes.length !== stat.size) {
      throw new DokionError(sizeMismatchCode, "Registry source file changed while it was read.", {
        expectedSize: stat.size,
        observedSize: bytes.length
      });
    }
    const observedDigest = digest(bytes);
    const digestMismatchCode = options.digestMismatchCode ?? "REGISTRY_ARTIFACT_DIGEST_MISMATCH";
    if (options.expectedDigest && observedDigest !== options.expectedDigest) {
      throw new DokionError(digestMismatchCode, "Registry source file digest does not match the expected digest.", {
        expectedDigest: options.expectedDigest,
        observedDigest
      });
    }
    return { bytes, size: bytes.length, digest: observedDigest };
  } finally {
    await handle.close();
  }
}
