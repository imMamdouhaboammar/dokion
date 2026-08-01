import { describe, expect, test } from "bun:test";

import { compareExactSemver } from "../../src/registry/digests.ts";

describe("Registry exact semantic version precedence", () => {
  test("orders prerelease identifiers according to SemVer 2.0.0", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0"
    ];

    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(compareExactSemver(ordered[index]!, ordered[index + 1]!)).toBe(-1);
      expect(compareExactSemver(ordered[index + 1]!, ordered[index]!)).toBe(1);
    }
  });

  test("ignores build metadata for precedence", () => {
    expect(compareExactSemver("1.0.0+build.1", "1.0.0+build.2")).toBe(0);
    expect(compareExactSemver("1.0.0-rc.1+build.1", "1.0.0-rc.1+build.2")).toBe(0);
  });

  test("orders numeric prerelease identifiers before non-numeric identifiers", () => {
    expect(compareExactSemver("1.0.0-1", "1.0.0-alpha")).toBe(-1);
    expect(compareExactSemver("1.0.0-alpha.2", "1.0.0-alpha.11")).toBe(-1);
  });
});
