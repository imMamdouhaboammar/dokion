import { createHash } from "node:crypto";

export interface GateResult {
  id: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  digest?: string;
}

export interface PromotionSignoffInput {
  version: string;
  commit: string;
  claimedSurfaces: string[];
  playbookDigest: string;
  lockDigest: string;
  gates: GateResult[];
  reviewer: string;
}

export interface PromotionSignoffRecord {
  schemaVersion: string;
  version: string;
  commit: string;
  claimedSurfaces: string[];
  playbookDigest: string;
  lockDigest: string;
  promotionReady: boolean;
  signoffDigest: string;
  signedAt: string;
  reviewer: string;
}

export function generatePromotionSignoffRecord(input: PromotionSignoffInput): PromotionSignoffRecord {
  const failingGates = input.gates.filter((g) => g.status !== "PASS");
  if (failingGates.length > 0 && failingGates[0]) {
    throw new Error(`Cannot generate promotion sign-off: promotion gate ${failingGates[0].id} did not pass`);
  }

  const payload = {
    version: input.version,
    commit: input.commit,
    claimedSurfaces: input.claimedSurfaces.sort(),
    playbookDigest: input.playbookDigest,
    lockDigest: input.lockDigest,
    gates: input.gates.map((g) => ({ id: g.id, status: g.status, digest: g.digest })),
    reviewer: input.reviewer,
  };

  const digestHex = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const signoffDigest = `sha256:${digestHex}`;

  return {
    schemaVersion: "1.0.0",
    version: input.version,
    commit: input.commit,
    claimedSurfaces: input.claimedSurfaces,
    playbookDigest: input.playbookDigest,
    lockDigest: input.lockDigest,
    promotionReady: true,
    signoffDigest,
    signedAt: new Date().toISOString(),
    reviewer: input.reviewer,
  };
}
