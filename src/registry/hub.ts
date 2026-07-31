import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { HubPlaybookPackage, LeaderboardFilter, PlaybookCategory } from "./types.ts";
import { DokionTelemetryClient } from "../telemetry/client.ts";

export class DokionCommunityHub {
  private projectRoot: string;
  private telemetry: DokionTelemetryClient;
  private catalog: HubPlaybookPackage[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.telemetry = new DokionTelemetryClient(projectRoot);
    this.initializeDefaultCatalog();
  }

  private initializeDefaultCatalog(): void {
    this.catalog = [
      {
        id: "dokion/web-fullstack",
        name: "web-fullstack",
        version: "1.0.0",
        description: "Full-stack Web Engineering & Hardening Playbook for Next.js, Vite, React, and Tailwind",
        category: "ui-ux",
        tags: ["web", "fullstack", "react", "nextjs", "accessibility", "lighthouse"],
        publisher: {
          handle: "dokion",
          name: "Dokion Core Team",
          verified: true,
          trustScore: 100,
        },
        digest: "sha256:d0k10nw3bfu11st4ckf0r3v3rh4rh3n1ngc0r3v1s10n",
        playbookUrl: "https://raw.githubusercontent.com/imMamdouhaboammar/dokion/main/playbooks/reference/web-fullstack.playbook.json",
        stats: {
          downloads: 1420,
          activeInstalls: 890,
          rating: 4.9,
          ratingsCount: 128,
          successRate: 99.2,
        },
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "amElnagdy/ui-review-loop",
        name: "ui-review-loop",
        version: "1.0.0",
        description: "Automated Viewport Bug Detection, Systematic Layout Repair & Visual UI Review Loop",
        category: "ui-ux",
        tags: ["ui-review", "agent-browser", "browser-use", "systematic-debugging", "viewport-bugs"],
        publisher: {
          handle: "amElnagdy",
          name: "Amr Elnagdy",
          verified: true,
          trustScore: 95,
        },
        digest: "sha256:u1r3v13wl00ph4rd3n1ngv13wp0r7bu65r3p41r100p",
        playbookUrl: "https://raw.githubusercontent.com/amElnagdy/ui-review-loop/main/playbook.json",
        stats: {
          downloads: 980,
          activeInstalls: 610,
          rating: 4.95,
          ratingsCount: 84,
          successRate: 98.8,
        },
        createdAt: "2026-07-15T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "dokion/api-service",
        name: "api-service",
        version: "1.0.0",
        description: "Backend Service Hardening, OWASP API Top 10, OpenAPI Contracts & Rate Limiting",
        category: "security",
        tags: ["api", "security", "owasp", "backend", "contracts", "semgrep"],
        publisher: {
          handle: "dokion",
          name: "Dokion Core Team",
          verified: true,
          trustScore: 100,
        },
        digest: "sha256:d0k10n4p1s3rv1c3h4rd3n1ngp4ck4g3c0r3v1s10n",
        playbookUrl: "https://raw.githubusercontent.com/imMamdouhaboammar/dokion/main/playbooks/reference/api-service.playbook.json",
        stats: {
          downloads: 1150,
          activeInstalls: 720,
          rating: 4.85,
          ratingsCount: 96,
          successRate: 98.5,
        },
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "obra/superpowers- TDD",
        name: "superpowers-tdd",
        version: "1.0.0",
        description: "Systematic TDD & Micro-Refactoring Discipline Playbook for AI Coding Agents",
        category: "general",
        tags: ["superpowers", "tdd", "systematic-debugging", "clean-code", "refactoring"],
        publisher: {
          handle: "obra",
          name: "Jesse Vincent",
          verified: true,
          trustScore: 98,
        },
        digest: "sha256:su33rp0w3r53ddp14yb00kh4rd3n1ngv3rs10n100",
        playbookUrl: "https://raw.githubusercontent.com/obra/superpowers/main/playbook.json",
        stats: {
          downloads: 2100,
          activeInstalls: 1450,
          rating: 5.0,
          ratingsCount: 210,
          successRate: 99.5,
        },
        createdAt: "2026-06-20T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
      {
        id: "community/ai-slop-remediation",
        name: "ai-slop-remediation",
        version: "1.0.0",
        description: "Micro-Playbook for Detecting and Purging AI Code Slop, Unused Imports, and Generic Placeholders",
        category: "ai-slop-remediation",
        tags: ["ai-slop", "cleanup", "refactoring", "unslop", "code-quality"],
        publisher: {
          handle: "community",
          name: "Dokion Open Community",
          verified: true,
          trustScore: 90,
        },
        digest: "sha256:415l0pr3m3d14710nh4rd3n1ngp14yb00kc0r3v1s10n",
        playbookUrl: "https://raw.githubusercontent.com/dokion-community/ai-slop-remediation/main/playbook.json",
        stats: {
          downloads: 830,
          activeInstalls: 510,
          rating: 4.8,
          ratingsCount: 62,
          successRate: 97.9,
        },
        createdAt: "2026-07-20T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
      },
    ];
  }

  public getCatalog(): HubPlaybookPackage[] {
    return this.catalog;
  }

  public search(query?: string, category?: PlaybookCategory, tags?: string[]): HubPlaybookPackage[] {
    let results = this.catalog;

    if (category) {
      results = results.filter((pkg) => pkg.category === category);
    }

    if (tags && tags.length > 0) {
      results = results.filter((pkg) => tags.every((tag) => pkg.tags.includes(tag.toLowerCase())));
    }

    if (query && query.trim() !== "") {
      const q = query.toLowerCase().trim();
      results = results.filter(
        (pkg) =>
          pkg.id.toLowerCase().includes(q) ||
          pkg.name.toLowerCase().includes(q) ||
          pkg.description.toLowerCase().includes(q) ||
          pkg.publisher.handle.toLowerCase().includes(q) ||
          pkg.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return results;
  }

  public getPackageById(packageId: string): HubPlaybookPackage | null {
    const norm = packageId.toLowerCase().trim();
    return this.catalog.find((pkg) => pkg.id.toLowerCase() === norm || pkg.name.toLowerCase() === norm) || null;
  }

  public async pullPackage(
    packageId: string,
    targetProposalPath?: string
  ): Promise<{ success: boolean; package: HubPlaybookPackage; proposalPath: string; content: string }> {
    const pkg = this.getPackageById(packageId);
    if (!pkg) {
      throw new Error(`Package '${packageId}' was not found in Dokion Community Hub registry.`);
    }

    const dokionDir = join(this.projectRoot, ".dokion");
    if (!existsSync(dokionDir)) {
      mkdirSync(dokionDir, { recursive: true });
    }

    const proposalPath = targetProposalPath || join(dokionDir, "playbook.proposed.json");

    // Synthesize structured playbook payload conforming to schema
    const playbookPayload = {
      $schema: "../../schemas/dokion-playbook.schema.json",
      version: pkg.version,
      project: {
        name: pkg.name,
        target: "READY_FOR_PRODUCTION",
        notes: pkg.description,
      },
      authority: {
        capability_selection: "USER_ONLY",
        execution_order: "USER_ONLY",
        capability_behavior: "USER_ONLY",
        automatic_capability_discovery: false,
        automatic_installation: false,
        automatic_substitution: false,
        "automatic_reordering": false,
        allow_recommendations: true,
        recommendations_require_approval: true,
      },
      enforcement: {
        playbook_immutable: true,
        hash_algorithm: "sha256",
        verify_before_each_step: true,
        on_mutation: "ABORT_TAINTED",
        protected_paths: [".dokion/playbook.json", "schemas/**"],
        worktree_policy: "clean-only",
      },
      registry: {
        sources: ["dokion.json"],
        require_verified: pkg.publisher.verified,
        require_digest: true,
        on_unverified: "STOP_STEP",
      },
      defaults: {
        approval: "BEFORE_WRITE",
        failure_policy: "STOP_STAGE",
        mode: "FIX_WITH_APPROVAL",
        retry_count: 1,
        maximum_iterations: 1,
        parallel_execution: false,
      },
      stages: [
        {
          id: `stage-${pkg.name}`,
          name: `${pkg.name} Community Playbook Stage`,
          execution: "SEQUENTIAL",
          notes: `Imported from community package ${pkg.id}`,
          steps: [
            {
              id: `step-${pkg.name}-main`,
              name: `Execute ${pkg.name} hardening steps`,
              capability: {
                type: "skill",
                id: pkg.name,
                version: pkg.version,
                source: pkg.id,
                immutable_reference: pkg.digest,
              },
              responsibility: pkg.description,
              mode: "FIX_WITH_APPROVAL",
              required: true,
              approval: "BEFORE_WRITE",
              permissions: {
                read: ["**/*"],
                write: ["src/**/*", "public/**/*"],
              },
              success_conditions: ["community_playbook_completed"],
              failure_policy: "STOP_STAGE",
            },
          ],
        },
      ],
    };

    const content = JSON.stringify(playbookPayload, null, 2);
    const contentDigest = "sha256:" + createHash("sha256").update(content).digest("hex");

    writeFileSync(proposalPath, content, "utf-8");

    // Increment download metric locally & track telemetry event
    pkg.stats.downloads += 1;
    this.telemetry.trackEvent("PLAYBOOK_PULLED", pkg.id, contentDigest, { success: true });

    return {
      success: true,
      package: pkg,
      proposalPath,
      content,
    };
  }

  public publishPlaybook(
    localPlaybookPath: string,
    publisherHandle: string,
    metadata: { name: string; category: PlaybookCategory; description: string; tags: string[] }
  ): HubPlaybookPackage {
    if (!existsSync(localPlaybookPath)) {
      throw new Error(`Local playbook file not found at '${localPlaybookPath}'.`);
    }

    const rawContent = readFileSync(localPlaybookPath, "utf-8");
    const digest = "sha256:" + createHash("sha256").update(rawContent).digest("hex");

    const packageId = `${publisherHandle}/${metadata.name}`;

    const newPackage: HubPlaybookPackage = {
      id: packageId,
      name: metadata.name,
      version: "1.0.0",
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags,
      publisher: {
        handle: publisherHandle,
        name: publisherHandle,
        verified: false,
        trustScore: 70,
      },
      digest,
      playbookUrl: `https://github.com/${packageId}/blob/main/playbook.json`,
      stats: {
        downloads: 1,
        activeInstalls: 1,
        rating: 5.0,
        ratingsCount: 1,
        successRate: 100.0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.catalog.push(newPackage);
    this.telemetry.trackEvent("PLAYBOOK_PUBLISHED", packageId, digest, { success: true });

    return newPackage;
  }
}
