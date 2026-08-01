import { DokionError } from "../core/errors.ts";
import type { HubPlaybookPackage, PlaybookCategory } from "./types.ts";

/**
 * Temporary fail-closed boundary for the Community Registry.
 *
 * The previous implementation populated an in-memory catalog, synthesized
 * publisher Playbooks, and reported local-only publishing as remote success.
 * Those behaviors are intentionally unavailable until the versioned Registry,
 * package verification, cache, and lockfile protocols are implemented.
 */
export class DokionCommunityHub {
  constructor(_projectRoot: string) {}

  public getCatalog(): HubPlaybookPackage[] {
    return [];
  }

  public search(_query?: string, _category?: PlaybookCategory, _tags?: string[]): HubPlaybookPackage[] {
    return [];
  }

  public getPackageById(_packageId: string): HubPlaybookPackage | null {
    return null;
  }

  public async pullPackage(
    packageId: string,
    _targetProposalPath?: string
  ): Promise<{ success: boolean; package: HubPlaybookPackage; proposalPath: string; content: string }> {
    throw new DokionError(
      "REGISTRY_SOURCE_REQUIRED",
      "No verified Playbook Registry source is configured. Pull is unavailable until source resolution and package-byte verification are implemented.",
      { packageId }
    );
  }

  public publishPlaybook(
    localPlaybookPath: string,
    publisherHandle: string,
    metadata: { name: string; category: PlaybookCategory; description: string; tags: string[] }
  ): HubPlaybookPackage {
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Publishing is unavailable until Dokion can create deterministic packages, write to an explicit Registry transport, and verify the remote bytes.",
      {
        localPlaybookPath,
        publisherHandle,
        packageName: metadata.name
      }
    );
  }
}
