import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { writeTextAtomic } from "../src/core/json.ts";
import { buildProductSurface, serializeProductSurface } from "../src/product/product-surface.ts";

/**
 * Writes the canonical product surface atomically under the requested root
 * and returns the generated repository-relative artifact path
 */
export async function writeProductSurfaceSnapshot(root: string): Promise<string> {
  const path = join(root, "generated", "product-surface.json");
  await mkdir(dirname(path), { recursive: true });
  await writeTextAtomic(path, serializeProductSurface(buildProductSurface()), "json");
  return path;
}

if (import.meta.main) {
  console.log(await writeProductSurfaceSnapshot(process.cwd()));
}
