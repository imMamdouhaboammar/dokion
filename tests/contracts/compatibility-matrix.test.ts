import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("support and compatibility matrix contract", () => {
  test("publishes the compatibility matrix from the README", async () => {
    const [readme, compatibility] = await Promise.all([
      read("README.md"),
      read("docs/compatibility.md")
    ]);

    expect(readme).toContain("docs/compatibility.md");
    expect(compatibility).toContain("## Claim vocabulary");
    expect(compatibility).toContain("## Delivery modes");
    expect(compatibility).toContain("## Agent adapters");
    expect(compatibility).toContain("## Host operating systems");
  });

  test("separates every required support surface", async () => {
    const compatibility = await read("docs/compatibility.md");

    for (const surface of [
      "Package mode",
      "Standalone binary mode",
      "Claude Code",
      "Codex",
      "Gemini CLI",
      "Linux",
      "macOS",
      "Windows"
    ]) {
      expect(compatibility).toContain(surface);
    }
  });

  test("distinguishes tested packaged degraded and unproven claims", async () => {
    const compatibility = await read("docs/compatibility.md");

    for (const status of ["TESTED", "PACKAGED", "DEGRADED", "NOT YET PROVEN"]) {
      expect(compatibility).toContain(status);
    }

    expect(compatibility).toContain("NO_HOOK_ENFORCEMENT");
    expect(compatibility).toContain("NO_SUBAGENT_ISOLATION");
    expect(compatibility).toContain("Ubuntu");
    expect(compatibility).toContain("host matrix");
    expect(compatibility).toContain("does not assert general production readiness");
  });
});
