import { createHash } from "node:crypto";

export type RetentionClass = "PERMANENT" | "EPHEMERAL" | "SHORT_TERM";

export interface EvidenceItem {
  id: string;
  retentionClass: RetentionClass;
  path: string;
}

export interface RetentionResult {
  prunedIds: string[];
  retainedIds: string[];
}

export interface BundleItem {
  path: string;
  content: string;
}

export interface ExportBundleInput {
  runId: string;
  commit: string;
  evidenceItems: BundleItem[];
}

export interface PortableBundle {
  runId: string;
  commit: string;
  bundleDigest: string;
  hasSecretKeys: boolean;
  items: BundleItem[];
}

export function enforceRetentionRules(
  items: EvidenceItem[],
  targetPruneClass: RetentionClass
): RetentionResult {
  const prunedIds: string[] = [];
  const retainedIds: string[] = [];

  for (const item of items) {
    if (item.retentionClass === "PERMANENT") {
      retainedIds.push(item.id);
    } else if (item.retentionClass === targetPruneClass) {
      prunedIds.push(item.id);
    } else {
      retainedIds.push(item.id);
    }
  }

  return { prunedIds, retainedIds };
}

export function exportRunBundle(input: ExportBundleInput): PortableBundle {
  const contentToHash = JSON.stringify({ runId: input.runId, commit: input.commit, items: input.evidenceItems });
  const digest = `sha256:${createHash("sha256").update(contentToHash).digest("hex")}`;

  const fullStr = JSON.stringify(input);
  const hasSecretKeys = /secret|password|token|private_key/i.test(fullStr) && !fullStr.includes("REDACTED");

  return {
    runId: input.runId,
    commit: input.commit,
    bundleDigest: digest,
    hasSecretKeys,
    items: input.evidenceItems,
  };
}

export function verifyRunBundle(bundle: PortableBundle): { valid: boolean; reason?: string } {
  if (!bundle.bundleDigest || !bundle.bundleDigest.startsWith("sha256:")) {
    return { valid: false, reason: "Invalid digest format" };
  }
  if (bundle.hasSecretKeys) {
    return { valid: false, reason: "Bundle contains unredacted secrets" };
  }
  return { valid: true };
}
