import { describe, expect, test } from "bun:test";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import { parseCliInvocation } from "../../src/cli/parser.ts";

function expectCode(action: () => unknown, code: DokionErrorCode): DokionError {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

describe("dokion registry pull CLI contract", () => {
  test("parses an exact package reference with explicit source, config, and cache", () => {
    expect(parseCliInvocation([
      "registry",
      "pull",
      "acme-security/secure-web-app@1.2.3",
      "--source",
      "example-registry",
      "--config",
      ".dokion/registries.json",
      "--cache",
      "/tmp/dokion-cache",
      "--format",
      "json"
    ])).toEqual({
      command: "registry",
      subcommand: "pull",
      packageReference: "acme-security/secure-web-app@1.2.3",
      source: "example-registry",
      configPath: ".dokion/registries.json",
      cacheRoot: "/tmp/dokion-cache",
      format: "json"
    });
  });

  test("requires one exact reference and every authority-bearing input explicitly", () => {
    for (const argv of [
      ["registry", "pull"],
      ["registry", "pull", "acme/pkg@1.0.0", "--source", "example", "--config", "registries.json"],
      ["registry", "pull", "acme/pkg@1.0.0", "--source", "example", "--cache", "cache"],
      ["registry", "pull", "acme/pkg@1.0.0", "--config", "registries.json", "--cache", "cache"]
    ]) {
      expectCode(() => parseCliInvocation(argv), "CLI_MISSING_ARGUMENT");
    }

    expectCode(() => parseCliInvocation([
      "registry",
      "pull",
      "acme/pkg@1.0.0",
      "other/pkg@1.0.0",
      "--source",
      "example",
      "--config",
      "registries.json",
      "--cache",
      "cache"
    ]), "CLI_INVALID_ARGUMENT");
  });
});
