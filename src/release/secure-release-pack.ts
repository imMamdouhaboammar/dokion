import { createHash } from "node:crypto";
import { join } from "node:path";
import { writeJsonAtomic } from "../core/json.ts";
import type { DokionPlaybook } from "../playbook/types.ts";

export type SecureReleasePack = "secure-release";

export interface SecureReleaseProposal {
  pack: SecureReleasePack;
  created_at: string;
  digest: string;
  proposalPath: string;
  playbook: DokionPlaybook;
}

export function computeProposalDigest(proposal: Partial<SecureReleaseProposal>): string {
  const contentStr = JSON.stringify(proposal.playbook ?? {});
  return createHash("sha256").update(contentStr).digest("hex");
}

export async function createSecureReleaseProposal(root: string, packName: SecureReleasePack): Promise<SecureReleaseProposal> {
  const proposalsDir = join(root, ".dokion", "proposals");
  const proposalPath = join(proposalsDir, `${packName}-proposal.json`);
  const mockPlaybook: DokionPlaybook = {
    schema_version: 1,
    version: "1.0",
    name: "Secure Release Playbook",
    description: "Built-in secure release playbook proposal",
    project: { name: "default" },
    authority: { selector: "sole" },
    stages: []
  };
  const digest = computeProposalDigest({ playbook: mockPlaybook });
  const proposal: SecureReleaseProposal = {
    pack: packName,
    created_at: new Date().toISOString(),
    digest,
    proposalPath,
    playbook: mockPlaybook
  };

  await writeJsonAtomic(proposalPath, proposal);
  return proposal;
}
