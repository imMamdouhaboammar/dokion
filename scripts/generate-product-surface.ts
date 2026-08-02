import { join } from "node:path";

import { writeTextAtomic } from "../src/core/json.ts";
import { buildProductSurface, serializeProductSurface } from "../src/product/product-surface.ts";

export async function writeProductSurfaceSnapshot(root: string): Promise<string> {
  const path = join(root, "generated", "product-surface.json");
  await writeTextAtomic(path, serializeProductSurface(buildProductSurface()), "json");
  return path;
}

if (import.meta.main) {
  console.log(await writeProductSurfaceSnapshot(process.cwd()));
}
