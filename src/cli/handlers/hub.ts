import { DokionError } from "../../core/errors.ts";
import { DokionCommunityHub } from "../../registry/hub.ts";
import type { PlaybookCategory } from "../../registry/types.ts";

export interface HubCliOptions {
  action?: "search" | "pull" | "publish" | "leaderboard" | "rate" | "fork" | "merge";
  query?: string;
  packageId?: string;
  category?: string;
  format?: "human" | "json";
  author?: string;
  stars?: number;
}

export async function handleHubCommand(
  projectRoot: string,
  options: HubCliOptions
): Promise<string> {
  const hub = new DokionCommunityHub(projectRoot);
  const action = options.action ?? "search";

  if (action === "search") {
    const packages = hub.search(
      options.query,
      options.category as PlaybookCategory | undefined
    );
    const reason =
      "No verified Registry source is configured. The federated Registry protocol is being implemented under issue #47.";

    if (options.format === "json") {
      return JSON.stringify(
        {
          status: "UNAVAILABLE",
          packages,
          reason
        },
        null,
        2
      );
    }

    return `Dokion Playbook Registry unavailable\n\n${reason}`;
  }

  if (action === "pull") {
    if (!options.packageId) {
      throw new DokionError(
        "CLI_MISSING_ARGUMENT",
        "Missing package reference for Registry pull.",
        { action }
      );
    }
    await hub.pullPackage(options.packageId);
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Registry pull returned without a verified package result.",
      { action, packageId: options.packageId }
    );
  }

  throw new DokionError(
    "REGISTRY_NOT_IMPLEMENTED",
    `Registry action '${action}' is unavailable until its transport, provenance, and state-transition contracts are implemented.`,
    { action }
  );
}
