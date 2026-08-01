import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(import.meta.dir, "../..");
const docsRoot = join(repositoryRoot, "docs");
const indexPath = join(docsRoot, "index.html");

function readPublicPage(): string {
  return readFileSync(indexPath, "utf8");
}

describe("public documentation truth boundary", () => {
  test("does not publish unsupported marketplace claims", () => {
    const page = readPublicPage();
    const forbiddenClaims = [
      "100% decentralized",
      "Verified Publisher",
      "Total Downloads",
      "Success Rate",
      "Editor's Choice",
      "Quality Leaderboard",
      "telemetry-backed"
    ];

    for (const claim of forbiddenClaims) {
      expect(page).not.toContain(claim);
    }
  });

  test("does not ship interactive controls for unavailable Registry actions", () => {
    const page = readPublicPage();

    expect(page).not.toContain("onclick=");
    expect(page).not.toContain("dokion hub pull");
    expect(page).not.toContain('<script src="app.js"></script>');
    expect(existsSync(join(docsRoot, "app.js"))).toBe(false);
    expect(existsSync(join(docsRoot, "catalog.json"))).toBe(false);
  });

  test("identifies itself as documentation and links to authoritative project records", () => {
    const page = readPublicPage();

    expect(page).toContain("Dokion Documentation");
    expect(page).toContain("Registry rebuild status");
    expect(page).toContain("SPEC.md");
    expect(page).toContain("SECURITY.md");
    expect(page).toContain("/issues/47");
  });
});
