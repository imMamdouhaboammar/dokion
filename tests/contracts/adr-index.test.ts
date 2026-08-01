import { describe, expect, test } from "bun:test";

const root = process.cwd();

async function read(path: string): Promise<string> {
  const file = Bun.file(`${root}/${path}`);
  expect(await file.exists()).toBe(true);
  return file.text();
}

describe("architecture decision record contract", () => {
  test("publishes the ADR index and accepted decisions", async () => {
    const index = await read("docs/adr/README.md");

    for (const path of [
      "0001-authority-model.md",
      "0002-bun-only-runtime.md",
      "0003-federated-playbook-registry.md",
      "0004-registry-trust-and-authority.md",
      "0005-public-site-is-not-authority.md"
    ]) {
      expect(index).toContain(path);
    }
    expect(index).toContain("Accepted");
    expect(index).toContain("Numbers are never recycled");
  });

  test("records context decision consequences and amendment rules", async () => {
    for (const path of [
      "docs/adr/0001-authority-model.md",
      "docs/adr/0002-bun-only-runtime.md",
      "docs/adr/0003-federated-playbook-registry.md",
      "docs/adr/0004-registry-trust-and-authority.md",
      "docs/adr/0005-public-site-is-not-authority.md"
    ]) {
      const adr = await read(path);
      for (const heading of ["## Context", "## Decision", "## Consequences", "## Alternatives considered", "## Amendment rules"]) {
        expect(adr).toContain(heading);
      }
      expect(adr).toContain("Status: Accepted");
      expect(adr).toContain("superseding ADR");
    }
  });

  test("locks the user-authority decision", async () => {
    const authority = await read("docs/adr/0001-authority-model.md");

    expect(authority).toContain(".dokion/playbook.json");
    expect(authority).toContain("sole file that authorizes Dokion execution");
    expect(authority).toContain("must never select, install, substitute, reorder, upgrade, enable");
    expect(authority).toContain("Bounded autopilot means deterministic continuation inside existing authority");
  });

  test("locks the Bun-only repository decision", async () => {
    const runtime = await read("docs/adr/0002-bun-only-runtime.md");

    for (const marker of [
      "Bun 1.3.14",
      "bun install --frozen-lockfile",
      "bun test",
      "bun pm pack",
      "bun publish",
      "npm, yarn, pnpm"
    ]) {
      expect(runtime).toContain(marker);
    }
    expect(runtime).toContain("An upstream installer exception never authorizes changing Dokion's own package manager");
  });

  test("locks the federated Registry source model", async () => {
    const registry = await read("docs/adr/0003-federated-playbook-registry.md");

    for (const marker of [
      "local filesystem",
      "HTTPS static source",
      "Git repository pinned to an immutable commit",
      "official Dokion Registry is a removable default",
      "namespace collisions fail closed",
      "content-addressed"
    ]) {
      expect(registry).toContain(marker);
    }
  });

  test("separates integrity identity installation and activation", async () => {
    const trust = await read("docs/adr/0004-registry-trust-and-authority.md");

    for (const marker of [
      "Integrity verification is not publisher identity verification",
      "Pull, install, and activate are separate state transitions",
      "Registry metadata never grants execution authority",
      "publisher identity unverified",
      "signature unavailable",
      "playbooks.lock.json"
    ]) {
      expect(trust).toContain(marker);
    }
  });

  test("keeps the public site outside the authority path", async () => {
    const site = await read("docs/adr/0005-public-site-is-not-authority.md");

    for (const marker of [
      "website is never the source of truth",
      "validated static snapshot",
      "no arbitrary remote Registry metadata in the browser",
      "No UI claim may precede",
      "ratings, download counts, active installs, execution percentages"
    ]) {
      expect(site).toContain(marker);
    }
  });
});
