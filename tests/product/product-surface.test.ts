import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeProductSurfaceSnapshot } from "../../scripts/generate-product-surface.ts";
import {
  CLI_COMMAND_REGISTRY,
  implementedCliCommands,
  plannedCliCommands
} from "../../src/cli/command-registry.ts";
import { buildProductSurface, serializeProductSurface } from "../../src/product/product-surface.ts";

describe("canonical product surface", () => {
  test("derives command status and evidence from the canonical registry", () => {
    const surface = buildProductSurface();

    expect(surface.schema_version).toBe("dokion.product-surface.v1");
    expect(surface.commands.map((entry) => entry.id)).toEqual(
      [...CLI_COMMAND_REGISTRY].map((entry) => entry.id).sort()
    );

    for (const command of surface.commands) {
      const descriptor = CLI_COMMAND_REGISTRY.find((entry) => entry.id === command.id);
      expect(descriptor).toBeDefined();
      expect(command.status).toBe(descriptor!.status);
      expect(command.evidence).toContain("src/cli/command-registry.ts");
    }
  });

  test("keeps the current command inventory explicit", () => {
    expect(implementedCliCommands()).toHaveLength(34);
    expect(plannedCliCommands()).toHaveLength(4);
    expect(plannedCliCommands().map((command) => command.id).sort()).toEqual([
      "accept",
      "hub",
      "trace",
      "try"
    ]);
  });

  test("keeps Secure Release planned until acceptance evidence exists", () => {
    const surface = buildProductSurface();
    expect(surface.packs).toContainEqual(expect.objectContaining({
      id: "secure-release",
      status: "PLANNED"
    }));
  });

  test("serializes deterministically", () => {
    const first = serializeProductSurface(buildProductSurface());
    const second = serializeProductSurface(buildProductSurface());
    expect(second).toBe(first);
    expect(first.endsWith("\n")).toBe(true);
  });

  test("writes a snapshot from a clean root", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-product-surface-"));
    try {
      const path = await writeProductSurfaceSnapshot(root);
      expect(path).toBe(join(root, "generated", "product-surface.json"));
      const written = await Bun.file(path).text();
      expect(written).toBe(serializeProductSurface(buildProductSurface()));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
