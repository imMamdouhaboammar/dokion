import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import {
  fetchVerifiedHttpsBytes,
  type RegistryNetworkResponse,
  type RegistryNetworkTransport
} from "../../src/registry/artifact-fetcher.ts";
import type { RegistryNetworkPolicy } from "../../src/registry/source-policy.ts";

const policy: RegistryNetworkPolicy = {
  https_only: true,
  allow_private_networks: false,
  maximum_redirects: 2,
  maximum_response_bytes: 32
};

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function chunks(...values: Array<string | Uint8Array>): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) yield typeof value === "string" ? Buffer.from(value) : value;
    }
  };
}

class ScriptedTransport implements RegistryNetworkTransport {
  readonly requests: Array<{ url: string; headers: Readonly<Record<string, string>> }> = [];

  constructor(
    private readonly handlers: Record<
      string,
      RegistryNetworkResponse | ((signal: AbortSignal) => Promise<RegistryNetworkResponse>)
    >
  ) {}

  async request(
    url: string,
    options: { signal: AbortSignal; headers: Readonly<Record<string, string>> }
  ): Promise<RegistryNetworkResponse> {
    this.requests.push({ url, headers: options.headers });
    const handler = this.handlers[url];
    if (!handler) throw new Error(`Unexpected request: ${url}`);
    return typeof handler === "function" ? handler(options.signal) : handler;
  }
}

function response(
  status: number,
  body: AsyncIterable<Uint8Array> = chunks(),
  headers: Record<string, string> = {}
): RegistryNetworkResponse {
  return { status, headers, body };
}

async function expectCode(action: Promise<unknown>, code: string): Promise<DokionError> {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

describe("bounded Registry HTTPS retrieval", () => {
  test("streams bytes, verifies exact size and digest, and returns credential-free evidence", async () => {
    const bytes = Buffer.from("verified artifact");
    const transport = new ScriptedTransport({
      "https://registry.example.test/artifact": response(200, chunks("verified ", "artifact"), {
        "content-length": String(bytes.length),
        "content-type": "application/vnd.dokion.package",
        "content-encoding": "identity"
      })
    });

    const result = await fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/artifact",
      expectedDigest: digest(bytes),
      expectedSize: bytes.length,
      policy,
      timeoutMs: 100,
      transport
    });

    expect(result.bytes).toEqual(bytes);
    expect(result.evidence.finalUrl).toBe("https://registry.example.test/artifact");
    expect(result.evidence.redirects).toBe(0);
    expect(JSON.stringify(result.evidence)).not.toContain("authorization");
    expect(JSON.stringify(result.evidence)).not.toContain("cookie");
    expect(transport.requests[0]!.headers).toEqual({ accept: "application/octet-stream" });
  });

  test("rejects digest mismatch, truncation, oversized streams, and unsupported content encoding", async () => {
    const actual = Buffer.from("actual");
    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/digest",
      expectedDigest: digest(Buffer.from("expected")),
      expectedSize: actual.length,
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/digest": response(200, chunks(actual), { "content-length": String(actual.length) })
      })
    }), "REGISTRY_ARTIFACT_DIGEST_MISMATCH");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/truncated",
      expectedDigest: digest(Buffer.from("short")),
      expectedSize: 10,
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/truncated": response(200, chunks("short"), { "content-length": "10" })
      })
    }), "REGISTRY_ARTIFACT_SIZE_MISMATCH");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/oversized",
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/oversized": response(200, chunks("x".repeat(33)))
      })
    }), "REGISTRY_RESPONSE_TOO_LARGE");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/compressed",
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/compressed": response(200, chunks("bytes"), { "content-encoding": "gzip" })
      })
    }), "REGISTRY_CONTENT_ENCODING_UNSUPPORTED");
  });

  test("rejects downgrade redirects, redirect loops, and excessive redirects", async () => {
    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/start",
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/start": response(302, chunks(), { location: "http://registry.example.test/artifact" })
      })
    }), "REGISTRY_REDIRECT_INVALID");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/a",
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/a": response(302, chunks(), { location: "https://registry.example.test/b" }),
        "https://registry.example.test/b": response(302, chunks(), { location: "https://registry.example.test/a" })
      })
    }), "REGISTRY_REDIRECT_LOOP");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/1",
      policy: { ...policy, maximum_redirects: 1 },
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/1": response(302, chunks(), { location: "https://registry.example.test/2" }),
        "https://registry.example.test/2": response(302, chunks(), { location: "https://registry.example.test/3" })
      })
    }), "REGISTRY_REDIRECT_LIMIT");
  });

  test("fails closed on timeout and transport failure", async () => {
    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/slow",
      policy,
      timeoutMs: 10,
      transport: new ScriptedTransport({
        "https://registry.example.test/slow": async (signal) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          return response(200, chunks("late"));
        }
      })
    }), "REGISTRY_SOURCE_TIMEOUT");

    await expectCode(fetchVerifiedHttpsBytes({
      url: "https://registry.example.test/failure",
      policy,
      timeoutMs: 100,
      transport: new ScriptedTransport({
        "https://registry.example.test/failure": async () => {
          throw new Error("connection reset by peer");
        }
      })
    }), "REGISTRY_SOURCE_UNAVAILABLE");
  });
});
