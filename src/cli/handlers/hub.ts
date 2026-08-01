import { DokionCommunityHub } from "../../registry/hub.ts";
import { DokionForkMergeEngine } from "../../registry/fork-merge.ts";
import { DokionLeaderboardEngine } from "../../registry/leaderboard.ts";
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
  const leaderboardEngine = new DokionLeaderboardEngine();
  const forkMergeEngine = new DokionForkMergeEngine(projectRoot);
  const action = options.action ?? "search";

  if (action === "leaderboard") {
    const category = options.category as PlaybookCategory | undefined;
    const ranked = leaderboardEngine.getLeaderboard(hub.getCatalog(), {
      ...(category !== undefined ? { category } : {}),
      limit: 10,
    });

    if (options.format === "json") {
      return JSON.stringify({ leaderboard: ranked }, null, 2);
    }

    let output = "🏆 Dokion Community Playbook Leaderboard (GitHub Native)\n";
    output += "========================================================\n\n";
    ranked.forEach((entry) => {
      const verifiedTag = entry.package.publisher.verified ? " [Verified ✅]" : "";
      output += `#${entry.rank} ${entry.package.id}${verifiedTag} | Score: ${entry.compositeScore}\n`;
      output += `   Category: ${entry.package.category} | Downloads: ${entry.package.stats.downloads} | Rating: ⭐ ${entry.package.stats.rating} | Success Rate: ${entry.package.stats.successRate}%\n`;
      output += `   ${entry.package.description}\n\n`;
    });
    return output;
  }

  if (action === "pull") {
    if (!options.packageId) {
      throw new Error("Please specify package ID to pull. e.g. dokion playbooks pull amElnagdy/ui-review-loop");
    }
    const result = await hub.pullPackage(options.packageId);
    if (options.format === "json") {
      return JSON.stringify(result, null, 2);
    }

    let output = `✅ Successfully pulled community playbook '${result.package.id}'!\n`;
    output += `📄 Created inert proposal at '${result.proposalPath}'\n`;
    output += `🔒 SHA-256 Digest: ${result.package.digest}\n`;
    output += "💡 To activate this playbook, run 'dokion playbooks sync' or copy it to '.dokion/playbook.json'.\n";
    return output;
  }

  if (action === "fork") {
    if (!options.packageId) {
      throw new Error("Please specify package ID to fork. e.g. dokion playbooks fork amElnagdy/ui-review-loop");
    }
    const pkg = hub.getPackageById(options.packageId);
    if (!pkg) {
      throw new Error(`Package '${options.packageId}' not found.`);
    }
    const author = options.author ?? "developer";
    const result = forkMergeEngine.forkPlaybook(pkg, author);
    if (options.format === "json") {
      return JSON.stringify(result, null, 2);
    }

    let output = `🍴 Successfully forked community playbook '${pkg.id}' by ${author}!\n`;
    output += `📄 Created proposal at '${result.proposalPath}'\n`;
    output += `🔗 Parent Digest: ${result.lineage.parentDigest}\n`;
    return output;
  }

  const results = hub.search(
    options.query,
    options.category as PlaybookCategory | undefined
  );

  if (options.format === "json") {
    return JSON.stringify({ packages: results }, null, 2);
  }

  let output = `🌐 Dokion Community Playbooks Registry (${results.length} found)\n`;
  output += "========================================================\n\n";
  results.forEach((pkg) => {
    const verified = pkg.publisher.verified ? " [Verified ✅]" : "";
    output += `📦 ${pkg.id}${verified} (v${pkg.version})\n`;
    output += `   Category: ${pkg.category} | Rating: ⭐ ${pkg.stats.rating} | Downloads: ${pkg.stats.downloads}\n`;
    output += `   ${pkg.description}\n`;
    output += `   Pull command: dokion playbooks pull ${pkg.id}\n\n`;
  });
  return output;
}
