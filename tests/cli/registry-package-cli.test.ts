import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import { parseCliInvocation } from "../../src/cli/parser.ts";

function expectCliError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect(String((error as DokionError).code)).toBe(code);
  }
}

describe("Registry package CLI parsing", () => {
  test("parses deterministic package creation", () => {
    expect(
      parseCliInvocation([
        "registry",
        "pack",
        "./playbook-package",
        "--output",
        "./dist/acme.dokion.tar",
        "--format",
        "json"
      ])
    ).toEqual({
      command: "registry",
      subcommand: "pack",
      directory: "./playbook-package",
      output: "./dist/acme.dokion.tar",
      overwrite: false,
      format: "json"
    });
  });

  test("parses explicit package replacement only when requested", () => {
    expect(
      parseCliInvocation([
        "registry",
        "pack",
        "./playbook-package",
        "--output",
        "./dist/acme.dokion.tar",
        "--overwrite"
      ])
    ).toEqual({
      command: "registry",
      subcommand: "pack",
      directory: "./playbook-package",
      output: "./dist/acme.dokion.tar",
      overwrite: true,
      format: "human"
    });
  });

  test("parses read-only package verification with exact expectations", () => {
    expect(
      parseCliInvocation([
        "registry",
        "verify-package",
        "./dist/acme.dokion.tar",
        "--package",
        "acme-security/secure-web-app",
        "--version",
        "1.2.3",
        "--format",
        "json"
      ])
    ).toEqual({
      command: "registry",
      subcommand: "verify-package",
      archive: "./dist/acme.dokion.tar",
      expectedPackageId: "acme-security/secure-web-app",
      expectedVersion: "1.2.3",
      format: "json"
    });
  });

  test("requires one source directory and an explicit output for pack", () => {
    expectCliError(
      () => parseCliInvocation(["registry", "pack", "./source"]),
      "CLI_MISSING_ARGUMENT"
    );
    expectCliError(
      () => parseCliInvocation(["registry", "pack", "./one", "./two", "--output", "out.tar"]),
      "CLI_INVALID_ARGUMENT"
    );
  });

  test("requires one archive and rejects unsupported Registry subcommands", () => {
    expectCliError(
      () => parseCliInvocation(["registry", "verify-package"]),
      "CLI_MISSING_ARGUMENT"
    );
    expectCliError(
      () => parseCliInvocation(["registry", "install", "package.tar"]),
      "CLI_INVALID_ARGUMENT"
    );
  });
});
