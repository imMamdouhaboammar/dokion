import { join } from "node:path";
import { readJson, writeJsonAtomic } from "../../core/json.ts";
import { computeProposalDigest, type SecureReleaseProposal } from "../../release/secure-release-pack.ts";

export async function handleAcceptCommand(digest: string | undefined, root: string): Promise<Record<string, unknown>> {
  if (!digest) {
    throw new Error("dokion accept requires a proposal digest");
  }
  const proposalsDir = join(root, ".dokion", "proposals");
  const proposalFiles = ["secure-release-proposal.json"];
  let matchedProposal: SecureReleaseProposal | null = null;

  for (const file of proposalFiles) {
    const fullPath = join(proposalsDir, file);
    try {
      const content = await readJson<SecureReleaseProposal>(fullPath);
      const computed = computeProposalDigest(content);
      if (computed === digest || content.digest === digest) {
        matchedProposal = content;
        break;
      }
    } catch {}
  }

  if (!matchedProposal) {
    return {
      ok: false,
      command: "accept",
      error: `No proposal matching digest ${digest} found in .dokion/proposals/`
    };
  }

  const activePlaybookPath = join(root, ".dokion", "playbook.json");
  await writeJsonAtomic(activePlaybookPath, matchedProposal.playbook);

  return {
    ok: true,
    command: "accept",
    digest,
    promoted_playbook: activePlaybookPath,
    steps_count: matchedProposal.playbook.stages.flatMap((s) => s.steps).length
  };
}
