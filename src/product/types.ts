export type ProductSurfaceStatus =
  | "IMPLEMENTED"
  | "EXPERIMENTAL"
  | "PLANNED"
  | "UNAVAILABLE";

export interface ProductSurfaceEntry {
  id: string;
  status: ProductSurfaceStatus;
  evidence: string[];
}

export interface ProductSurface {
  schema_version: "dokion.product-surface.v1";
  generated_from_version: string;
  commands: ProductSurfaceEntry[];
  integrations: ProductSurfaceEntry[];
  packs: ProductSurfaceEntry[];
  registry: ProductSurfaceEntry[];
}
