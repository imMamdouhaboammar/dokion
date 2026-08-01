import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import {
  assertSafeHttpsUrl,
  parseExactPackageReference,
  parseRegistryConfig,
  selectRegistrySource,
  type RegistryNetworkPolicy
} from "../../src/registry/source-policy.ts";

const authority = {
  selection_authority: false,
  substitution_authority: false,
  installation_authority: false,
  activation_authority: false,
  execution_authority: false
} as const;

const networkPolicy: RegistryNetworkPolicy = {
  https_only: true,
  allow_private_networks: false,
  maximum_redirects: 3,
  maximum_response_bytes: 1024 * 1024
};

function config(sources: unknown[]): unknown {
  return {
    schema: "dokion.registry-config.v1",
    scope: "project",
    revision: 1,
    sources,
    network_policy: networkPolicy,
    authority
  };
}

function expectCode(action: () => unknown, code: string): DokionError {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

describe("Registry source policy", () => {
  test("parses only protocol-defined local, HTTPS, and pinned Git sources", () => {
    const parsed = parseRegistryConfig(config([
      {
        name: "local-registry",
        id: "local.registry",
        priority: 0,
        enabled: true,
        cache_ttl_seconds: 0,
        transport: "local",
        path: "/tmp/registry"
      },
      {
        name: "example-registry",
        id: "example.registry",
        priority: 10,
        enabled: true,
        cache_ttl_seconds: 3600,
        transport: "https",
        url: "https://registry.example.test/root.json"
      },
      {
        name: "git-registry",
        id: "git.registry",
        priority: 20,
        enabled: true,
        cache_ttl_seconds: 3600,
        transport: "git",
        url: "https://github.com/example/registry.git",
        immutable_revision: "a".repeat(40),
        root_path: "registry/root.json"
      }
    ]));

    expect(parsed.sources.map((source) => source.transport)).toEqual(["local", "https", "git"]);
    expect(selectRegistrySource(parsed, "example-registry").id).toBe("example.registry");
    expect(selectRegistrySource(parsed, "git.registry").name).toBe("git-registry");
  });

  test("rejects duplicate source names, duplicate source IDs, unknown fields, and disabled selection", () => {
    expectCode(() => parseRegistryConfig(config([
      { name: "same-name", id: "first.source", priority: 0, enabled: true, cache_ttl_seconds: 0, transport: "local", path: "/tmp/a" },
      { name: "same-name", id: "second.source", priority: 1, enabled: true, cache_ttl_seconds: 0, transport: "local", path: "/tmp/b" }
    ])), "REGISTRY_CONFIG_INVALID");

    expectCode(() => parseRegistryConfig(config([
      { name: "first-source", id: "same.source", priority: 0, enabled: true, cache_ttl_seconds: 0, transport: "local", path: "/tmp/a" },
      { name: "second-source", id: "same.source", priority: 1, enabled: true, cache_ttl_seconds: 0, transport: "local", path: "/tmp/b" }
    ])), "REGISTRY_CONFIG_INVALID");

    expectCode(() => parseRegistryConfig(config([
      { name: "extra-source", id: "extra.source", priority: 0, enabled: true, cache_ttl_seconds: 0, transport: "local", path: "/tmp/a", token: "secret" }
    ])), "REGISTRY_CONFIG_INVALID");

    const parsed = parseRegistryConfig(config([
      { name: "disabled-source", id: "disabled.source", priority: 0, enabled: false, cache_ttl_seconds: 0, transport: "local", path: "/tmp/a" }
    ]));
    expectCode(() => selectRegistrySource(parsed, "disabled-source"), "REGISTRY_SOURCE_DISABLED");
  });

  test("rejects credential-bearing, mutable, fragmented, queried, downgraded, and private HTTPS URLs", () => {
    for (const value of [
      "https://user:token@example.test/root.json",
      "http://registry.example.test/root.json",
      "https://registry.example.test/root.json#fragment",
      "https://registry.example.test/root.json?token=secret",
      "https://localhost/root.json",
      "https://127.0.0.1/root.json",
      "https://10.0.0.5/root.json",
      "https://169.254.10.10/root.json",
      "https://192.168.1.10/root.json"
    ]) {
      expectCode(() => assertSafeHttpsUrl(value, networkPolicy, "registry source"), "REGISTRY_SOURCE_URL_INVALID");
    }

    expect(assertSafeHttpsUrl("https://registry.example.test/root.json", networkPolicy, "registry source").href)
      .toBe("https://registry.example.test/root.json");
  });

  test("requires immutable exact package references", () => {
    expect(parseExactPackageReference("acme-security/secure-web-app@1.2.3")).toEqual({
      packageId: "acme-security/secure-web-app",
      namespace: "acme-security",
      name: "secure-web-app",
      version: "1.2.3"
    });

    for (const value of [
      "acme-security/secure-web-app",
      "acme-security/secure-web-app@latest",
      "acme-security/secure-web-app@^1.2.3",
      "../secure-web-app@1.2.3",
      "ACME/secure-web-app@1.2.3"
    ]) {
      expectCode(() => parseExactPackageReference(value), "REGISTRY_PACKAGE_REFERENCE_INVALID");
    }
  });
});
