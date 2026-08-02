import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  FORBIDDEN_UNQUALIFIED_PUBLIC_CLAIMS,
  PUBLIC_CLAIM_DOCUMENTS
} from "../../src/product/public-claims.ts";
import { buildProductSurface } from "../../src/product/product-surface.ts";

const root = process.cwd();

async function markdownFiles(directory: string): Promise<string[]> {
  return (await readdir(join(root, directory)))
    .filter((name) => name.endsWith(".md"))
    .map((name) => `${directory}/${name}`)
    .sort();
}

describe("public claim truth boundary", () => {
  test("registers every public adoption document in the canonical inventory", async () => {
    const discovered = [
      "README.md",
      ...(await markdownFiles("docs/getting-started")),
      ...(await markdownFiles("docs/launch"))
    ].sort();
    const registered = PUBLIC_CLAIM_DOCUMENTS.map((document) => document.path).sort();

    expect(new Set(registered).size).toBe(registered.length);
    expect(registered).toEqual(discovered);
  });

  test("requires explicit implemented, planned, and unavailable markers", async () => {
    const productSurface = buildProductSurface();

    for (const document of PUBLIC_CLAIM_DOCUMENTS) {
      const source = await Bun.file(join(root, document.path)).text();
      expect(document.claims.length).toBeGreaterThan(0);
      expect(new Set(document.claims.map((claim) => claim.id)).size).toBe(document.claims.length);

      for (const claim of document.claims) {
        expect(source).toContain(claim.requiredMarker);

        if (claim.productSurfaceId && claim.productSurfaceSection) {
          const productEntry = productSurface[claim.productSurfaceSection].find(
            (entry) => entry.id === claim.productSurfaceId
          );
          expect(productEntry).toBeDefined();
          expect(productEntry?.status).toBe(claim.status);
        }
      }

      for (const forbidden of FORBIDDEN_UNQUALIFIED_PUBLIC_CLAIMS) {
        expect(source).not.toMatch(forbidden);
      }
    }
  });

  test("describes the current verify command as independent declared-gate execution", async () => {
    const readme = await Bun.file(join(root, "README.md")).text();
    expect(readme).toContain(
      "`dokion verify` independently re-runs every supported declared `step.verification` command and every release gate against the current repository identity"
    );
    expect(readme).not.toContain(
      "`dokion verify` currently validates repository and Playbook contracts"
    );
  });
});
