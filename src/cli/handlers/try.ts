import { createSecureReleaseProposal, type SecureReleasePack } from "../../release/secure-release-pack.ts";

export async function handleTryCommand(pack: string | undefined, root: string): Promise<Record<string, unknown>> {
  const packName = (pack ?? "secure-release").toLowerCase() as SecureReleasePack;
  const result = await createSecureReleaseProposal(root, packName);
  return {
    ok: true,
    command: "try",
    pack: packName,
    proposal_path: result.proposalPath,
    digest: result.digest,
    requires_approval: true
  };
}
