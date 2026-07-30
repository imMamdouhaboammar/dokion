import { describe, expect, test } from "bun:test";

import { DokionError } from "../../src/core/errors.ts";
import { recordPackageProvenance } from "../../src/capability/package-provenance.ts";

function bunInput() {
  return {
    capabilityId: "semgrep",
    packageManager: "bun",
    registry: "https://registry.npmjs.org/",
    packageName: "@dokion/semgrep-adapter",
    version: "2.3.4",
    integrity: "sha512-YWJjZGVmZw==",
    installerCommand: "bun add --global @dokion/semgrep-adapter@2.3.4",
    verifier: {
      identity: "mamdouh",
      verifiedAt: "2026-07-30T19:00:00.000Z"
    }
  };
}

describe("CAP-005 package provenance", () => {
  test("records a Bun package with immutable verification metadata", () => {
    const result = recordPackageProvenance(bunInput());

    expect(result).toEqual({
      schema_version: 1,
      capability_id: "semgrep",
      package_manager: "bun",
      registry: "https://registry.npmjs.org/",
      package: {
        name: "@dokion/semgrep-adapter",
        version: "2.3.4",
        integrity: "sha512-YWJjZGVmZw=="
      },
      installer: {
        command: "bun add --global @dokion/semgrep-adapter@2.3.4"
      },
      verifier: {
        identity: "mamdouh",
        verified_at: "2026-07-30T19:00:00.000Z"
      },
      redacted_fields: []
    });
  });

  test("rejects a non-Bun installer without an explicit approved exception", () => {
    const input = {
      ...bunInput(),
      packageManager: "npm",
      installerCommand: "NPM_TOKEN=rejection-secret npm install -g package"
    };

    expect(() => recordPackageProvenance(input)).toThrow(DokionError);
    try {
      recordPackageProvenance(input);
    } catch (error) {
      expect(error).toBeInstanceOf(DokionError);
      expect((error as DokionError).code).toBe("APPROVAL_REQUIRED");
      expect(JSON.stringify(error)).not.toContain("rejection-secret");
    }
  });

  test("records an approved installer exception and redacts credentials", () => {
    const result = recordPackageProvenance({
      ...bunInput(),
      packageManager: "npm",
      registry: "https://user:registry-secret@registry.example.com/npm?token=query-secret#private",
      installerCommand: "NPM_TOKEN=env-secret npm install -g @dokion/semgrep-adapter@2.3.4 --token cli-secret",
      installerException: {
        reason: "The upstream package documents npm as its supported installer.",
        approval: {
          by: "mamdouh",
          at: "2026-07-30T18:55:00.000Z"
        }
      }
    });

    expect(result.registry).toBe("https://registry.example.com/npm");
    expect(result.installer.command).toBe(
      "NPM_TOKEN=[REDACTED] npm install -g @dokion/semgrep-adapter@2.3.4 --token [REDACTED]"
    );
    expect(result.installer_exception).toEqual({
      preferred_package_manager: "bun",
      used_package_manager: "npm",
      reason: "The upstream package documents npm as its supported installer.",
      approved_by: "mamdouh",
      approved_at: "2026-07-30T18:55:00.000Z"
    });
    expect(result.redacted_fields).toEqual(["installer.command", "registry"]);
    const serialized = JSON.stringify(result);
    for (const secret of ["registry-secret", "query-secret", "env-secret", "cli-secret"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  test("rejects floating package versions and ranges", () => {
    for (const version of ["latest", "next", "^2.3.4", "~2.3.4", ">=2.0.0", "*"]) {
      expect(() => recordPackageProvenance({ ...bunInput(), version })).toThrow(DokionError);
    }
  });

  test("rejects malformed immutable and verification metadata", () => {
    expect(() => recordPackageProvenance({
      ...bunInput(),
      integrity: "latest",
      verifier: { identity: "", verifiedAt: "not-a-date" }
    })).toThrow(DokionError);
  });

  test("rejects an exception whose approval is incomplete", () => {
    expect(() => recordPackageProvenance({
      ...bunInput(),
      packageManager: "pnpm",
      installerCommand: "pnpm add --global package",
      installerException: {
        reason: "Upstream exception.",
        approval: { by: "", at: "2026-07-30T18:55:00.000Z" }
      }
    })).toThrow(DokionError);
  });
});
