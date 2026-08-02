import { CLI_COMMAND_REGISTRY } from "../cli/command-registry.ts";
import { DOKION_VERSION } from "../runtime/package-metadata.ts";
import type { ProductSurface, ProductSurfaceEntry } from "./types.ts";

function sortedUnique(entries: ProductSurfaceEntry[]): ProductSurfaceEntry[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate product surface entry: ${entry.id}`);
    ids.add(entry.id);
  }

  return entries
    .map((entry) => ({ ...entry, evidence: [...entry.evidence].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

const INTEGRATIONS: ProductSurfaceEntry[] = [
  {
    id: "claude-code",
    status: "IMPLEMENTED",
    evidence: [".claude-plugin/plugin.json", "tests/m5-platform-adapters.test.ts"]
  },
  {
    id: "codex",
    status: "IMPLEMENTED",
    evidence: [".codex/AGENTS.md", "tests/m5-platform-adapters.test.ts"]
  },
  {
    id: "gemini-cli",
    status: "IMPLEMENTED",
    evidence: ["gemini-extension.json", "tests/m5-platform-adapters.test.ts"]
  }
];

const PACKS: ProductSurfaceEntry[] = [
  {
    id: "secure-release",
    status: "PLANNED",
    evidence: ["docs/superpowers/plans/2026-08-02-secure-release-guided-first-run.md"]
  }
];

const REGISTRY: ProductSurfaceEntry[] = [
  {
    id: "artifact-pull",
    status: "IMPLEMENTED",
    evidence: ["src/registry/pull-service.ts", "tests/registry/pull-service.test.ts"]
  },
  {
    id: "package-build",
    status: "IMPLEMENTED",
    evidence: ["src/registry/package-builder.ts", "tests/registry/package-builder-verifier.test.ts"]
  },
  {
    id: "package-verify",
    status: "IMPLEMENTED",
    evidence: ["src/registry/package-verifier.ts", "tests/registry/package-builder-verifier.test.ts"]
  },
  {
    id: "package-install",
    status: "UNAVAILABLE",
    evidence: ["docs/architecture/registry-truth-audit.md"]
  },
  {
    id: "package-activation",
    status: "UNAVAILABLE",
    evidence: ["docs/architecture/registry-truth-audit.md"]
  },
  {
    id: "package-publish",
    status: "UNAVAILABLE",
    evidence: ["docs/architecture/registry-truth-audit.md"]
  }
];

export function buildProductSurface(): ProductSurface {
  return {
    schema_version: "dokion.product-surface.v1",
    generated_from_version: DOKION_VERSION,
    commands: sortedUnique(CLI_COMMAND_REGISTRY.map((command) => ({
      id: command.id,
      status: command.status,
      evidence: ["src/cli/command-registry.ts"]
    }))),
    integrations: sortedUnique(INTEGRATIONS),
    packs: sortedUnique(PACKS),
    registry: sortedUnique(REGISTRY)
  };
}

export function serializeProductSurface(surface: ProductSurface): string {
  return `${JSON.stringify(surface, null, 2)}\n`;
}
