import { DokionCommunityHub } from "../../registry/hub.ts";
import { DokionLeaderboardEngine } from "../../registry/leaderboard.ts";
import { DokionForkMergeEngine } from "../../registry/fork-merge.ts";
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

  const action = options.action || "search";

  if (action === "leaderboard") {
    const filterCategory = options.category as PlaybookCategory | undefined;
    const ranked = leaderboardEngine.getLeaderboard(hub.getCatalog(), {
      category: filterCategory,
      limit: 10,
    });

    if (options.format === "json") {
      return JSON.stringify({ leaderboard: ranked }, null, 2);
    }

    let out = "🏆 Dokion Community Playbook Leaderboard (GitHub Native)\n";
    out += "================================──────────────────────────────\n\n";
    ranked.forEach((entry) => {
      const verifiedTag = entry.package.publisher.verified ? " [Verified ✅]" : "";
      out += `#${entry.rank} ${entry.package.id}${verifiedTag} — Score: ${entry.compositeScore}\n`;
      out += `   Category: ${entry.package.category} | Downloads: ${entry.package.stats.downloads} | Rating: ⭐ ${entry.package.stats.rating} | Success Rate: ${entry.package.stats.successRate}%\n`;
      out += `   ${entry.package.description}\n\n`;
    });
    return out;
  }

  if (action === "pull") {
    if (!options.packageId) {
      throw new Error("Please specify package ID to pull. e.g. dokion playbooks pull amElnagdy/ui-review-loop");
    }
    const res = await hub.pullPackage(options.packageId);
    if (options.format === "json") {
      return JSON.stringify(res, null, 2);
    }

    let out = `✅ Successfully pulled community playbook '${res.package.id}'!\n`;
    out += `📄 Created inert proposal at '${res.proposalPath}'\n`;
    out += `🔒 SHA-256 Digest: ${res.package.digest}\n`;
    out += `💡 To activate this playbook, run 'dokion playbooks sync' or copy it to '.dokion/playbook.json'.\n`;
    return out;
  }

  if (action === "fork") {
    if (!options.packageId) {
      throw new Error("Please specify package ID to fork. e.g. dokion playbooks fork amElnagdy/ui-review-loop");
    }
    const pkg = hub.getPackageById(options.packageId);
    if (!pkg) {
      throw new Error(`Package '${options.packageId}' not found.`);
    }
    const author = options.author || "developer";
    const res = forkMergeEngine.forkPlaybook(pkg, author);
    if (options.format === "json") {
      return JSON.stringify(res, null, 2);
    }

    let out = `🍴 Successfully forked community playbook '${pkg.id}' by ${author}!\n`;
    out += `📄 Created proposal at '${res.proposalPath}'\n`;
    out += `🔗 Parent Digest: ${res.lineage.parentDigest}\n`;
    return out;
  }

  // Default: Search / List
  const results = hub.search(options.query, options.category as PlaybookCategory | undefined);

  if (options.format === "json") {
    return JSON.stringify({ packages: results }, null, 2);
  }

  let out = `🌐 Dokion Community Playbooks Registry (${results.length} found)\n`;
  out += "================================──────────────────────────────\n\n";
  results.forEach((pkg) => {
    const verified = pkg.publisher.verified ? " [Verified ✅]" : "";
    out += `📦 ${pkg.id}${verified} (v${pkg.version})\n`;
    out += `   Category: ${pkg.category} | Rating: ⭐ ${pkg.stats.rating} | Downloads: ${pkg.stats.downloads}\n`;
    out += `   ${pkg.description}\n`;
    out += `   Pull command: dokion playbooks pull ${pkg.id}\n\n`;
  });
  return out;
}
