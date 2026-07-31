import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ForkLineage, HubPlaybookPackage } from "./types.ts";

export class DokionForkMergeEngine {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  public forkPlaybook(
    parentPackage: HubPlaybookPackage,
    forkAuthor: string,
    outputProposalPath?: string
  ): { success: boolean; lineage: ForkLineage; proposalPath: string; content: string } {
    const targetPath = outputProposalPath || join(this.projectRoot, ".dokion", "playbook.proposed.json");

    const lineage: ForkLineage = {
      parentPackageId: parentPackage.id,
      parentDigest: parentPackage.digest,
      parentVersion: parentPackage.version,
      forkAuthor,
      forkedAt: new Date().toISOString(),
    };

    const payload = {
      $schema: "../../schemas/dokion-playbook.schema.json",
      version: `${parentPackage.version}-fork`,
      lineage,
      project: {
        name: `${parentPackage.name}-forked-by-${forkAuthor}`,
        target: "READY_FOR_PRODUCTION",
        notes: `Forked from ${parentPackage.id} by ${forkAuthor}`,
      },
      authority: {
        capability_selection: "USER_ONLY",
        execution_order: "USER_ONLY",
        capability_behavior: "USER_ONLY",
        automatic_capability_discovery: false,
        automatic_installation: false,
        automatic_substitution: false,
        automatic_reordering: false,
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
          id: `stage-${parentPackage.name}-fork`,
          name: `${parentPackage.name} Forked Stage`,
          execution: "SEQUENTIAL",
          steps: [
            {
              id: `step-${parentPackage.name}-custom`,
              name: `Customized step from ${parentPackage.id}`,
              capability: {
                type: "skill",
                id: parentPackage.name,
                version: parentPackage.version,
                source: parentPackage.id,
                immutable_reference: parentPackage.digest,
              },
              responsibility: parentPackage.description,
              mode: "FIX_WITH_APPROVAL",
              required: true,
              approval: "BEFORE_WRITE",
              permissions: {
                read: ["**/*"],
                write: ["src/**/*", "public/**/*"],
              },
              success_conditions: ["fork_step_completed"],
              failure_policy: "STOP_STAGE",
            },
          ],
        },
      ],
    };

    const content = JSON.stringify(payload, null, 2);
    writeFileSync(targetPath, content, "utf-8");

    return {
      success: true,
      lineage,
      proposalPath: targetPath,
      content,
    };
  }

  public mergePlaybookUpdates(
    activePlaybookPath: string,
    upstreamPackage: HubPlaybookPackage
  ): { success: boolean; mergedContent: string; newDigest: string } {
    if (!existsSync(activePlaybookPath)) {
      throw new Error(`Active playbook at '${activePlaybookPath}' does not exist.`);
    }

    const currentRaw = readFileSync(activePlaybookPath, "utf-8");
    const parsed = JSON.parse(currentRaw);

    // Merge notes and update lineage reference
    parsed.project = parsed.project || {};
    parsed.project.notes = `${parsed.project.notes || ""} [Merged upstream updates from ${upstreamPackage.id} @ ${upstreamPackage.version}]`;
    parsed.lineage = {
      parentPackageId: upstreamPackage.id,
      parentDigest: upstreamPackage.digest,
      parentVersion: upstreamPackage.version,
      mergedAt: new Date().toISOString(),
    };

    const mergedContent = JSON.stringify(parsed, null, 2);
    const newDigest = "sha256:" + createHash("sha256").update(mergedContent).digest("hex");

    writeFileSync(activePlaybookPath, mergedContent, "utf-8");

    return {
      success: true,
      mergedContent,
      newDigest,
    };
  }
}
