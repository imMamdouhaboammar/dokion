import { join } from "node:path";
import { implementedCliCommands, plannedCliCommands } from "../cli/command-registry.ts";
import { builtinCatalog } from "./builtin-catalog.ts";
import { DOKION_VERSION } from "../runtime/package-metadata.ts";

export interface ProductSurfaceCommand {
  id: string;
  command: string;
  purpose: string;
  status: "IMPLEMENTED" | "PLANNED";
}

export interface ProductSurfaceCapabilities {
  total_skills_count: number;
  total_tools_count: number;
  total_plugins_count: number;
  total_loops_count: number;
  frameworks: { id: string; name: string }[];
}

export interface ProductSurface {
  version: string;
  repository_url: string;
  commands: ProductSurfaceCommand[];
  capabilities: ProductSurfaceCapabilities;
}

export function generateProductSurface(rootDirectory: string): ProductSurface {
  const implemented = implementedCliCommands().map((cmd) => ({
    id: cmd.id,
    command: cmd.manifestCommand,
    purpose: cmd.purpose,
    status: "IMPLEMENTED" as const
  }));

  const planned = plannedCliCommands().map((cmd) => ({
    id: cmd.id,
    command: cmd.manifestCommand,
    purpose: cmd.purpose,
    status: "PLANNED" as const
  }));

  const catalog = builtinCatalog;

  return {
    version: DOKION_VERSION,
    repository_url: "https://github.com/imMamdouhaboammar/dokion",
    commands: [...implemented, ...planned],
    capabilities: {
      total_skills_count: catalog.capability_catalog?.skills?.length ?? 0,
      total_tools_count: catalog.capability_catalog?.tools?.length ?? 0,
      total_plugins_count: 0,
      total_loops_count: 0,
      frameworks: [
        { id: "react", name: "React" },
        { id: "nextjs", name: "Next.js" },
        { id: "express", name: "Express" },
        { id: "fastapi", name: "FastAPI" },
        { id: "pnpm", name: "pnpm Monorepo" },
        { id: "go", name: "Go" },
        { id: "rust", name: "Rust" },
        { id: "vue", name: "Vue" },
        { id: "django", name: "Django" },
        { id: "nestjs", name: "NestJS" }
      ]
    }
  };
}
