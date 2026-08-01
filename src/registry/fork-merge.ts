import { DokionError } from "../core/errors.ts";
import type { ForkLineage, HubPlaybookPackage } from "./types.ts";

/**
 * Temporary compatibility shell for the removed Registry fork and merge flow.
 *
 * Fork and merge require verified package bytes, validated lineage, project
 * lockfile state, authority diffs, approval, atomic writes, and rollback.
 * None of those guarantees may be inferred from Registry metadata alone.
 */
export class DokionForkMergeEngine {
  constructor(_projectRoot: string) {}

  public forkPlaybook(
    parentPackage: HubPlaybookPackage,
    forkAuthor: string,
    outputProposalPath?: string
  ): { success: boolean; lineage: ForkLineage; proposalPath: string; content: string } {
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Playbook fork is unavailable until verified package lineage and inert project installation are implemented.",
      {
        packageId: parentPackage.id,
        forkAuthor,
        ...(outputProposalPath !== undefined ? { outputProposalPath } : {})
      }
    );
  }

  public mergePlaybookUpdates(
    activePlaybookPath: string,
    upstreamPackage: HubPlaybookPackage
  ): { success: boolean; mergedContent: string; newDigest: string } {
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Playbook merge is unavailable until locked package updates, authority diffs, approval, and rollback are implemented.",
      {
        activePlaybookPath,
        packageId: upstreamPackage.id
      }
    );
  }
}
