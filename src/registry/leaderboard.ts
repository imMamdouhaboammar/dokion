import type { HubPlaybookPackage, LeaderboardFilter } from "./types.ts";

export interface RankedLeaderboardEntry {
  rank: number;
  package: HubPlaybookPackage;
  compositeScore: number;
  scoreBreakdown: {
    downloadsScore: number;
    ratingScore: number;
    successRateScore: number;
    verifiedBonus: number;
  };
}

export class DokionLeaderboardEngine {
  /**
   * Calculates composite score for a package:
   * Score = (25 * log10(downloads + 1)) + (15 * rating) + (40 * (successRate / 100)) + (verified ? 20 : 0)
   */
  public calculateScore(pkg: HubPlaybookPackage): { compositeScore: number; scoreBreakdown: RankedLeaderboardEntry["scoreBreakdown"] } {
    const downloadsScore = Math.round(25 * Math.log10(pkg.stats.downloads + 1) * 100) / 100;
    const ratingScore = Math.round(15 * pkg.stats.rating * 100) / 100;
    const successRateScore = Math.round(40 * (pkg.stats.successRate / 100) * 100) / 100;
    const verifiedBonus = pkg.publisher.verified ? 20 : 0;

    const compositeScore = Math.round((downloadsScore + ratingScore + successRateScore + verifiedBonus) * 100) / 100;

    return {
      compositeScore,
      scoreBreakdown: {
        downloadsScore,
        ratingScore,
        successRateScore,
        verifiedBonus,
      },
    };
  }

  public getLeaderboard(
    packages: HubPlaybookPackage[],
    filter?: LeaderboardFilter
  ): RankedLeaderboardEntry[] {
    let list = [...packages];

    if (filter?.category) {
      list = list.filter((p) => p.category === filter.category);
    }

    if (filter?.minRating) {
      list = list.filter((p) => p.stats.rating >= filter.minRating!);
    }

    if (filter?.verifiedOnly) {
      list = list.filter((p) => p.publisher.verified);
    }

    const ranked: RankedLeaderboardEntry[] = list.map((pkg) => {
      const { compositeScore, scoreBreakdown } = this.calculateScore(pkg);
      return {
        rank: 0,
        package: pkg,
        compositeScore,
        scoreBreakdown,
      };
    });

    const sortBy = filter?.sortBy || "score";

    ranked.sort((a, b) => {
      if (sortBy === "downloads") return b.package.stats.downloads - a.package.stats.downloads;
      if (sortBy === "rating") return b.package.stats.rating - a.package.stats.rating;
      if (sortBy === "successRate") return b.package.stats.successRate - a.package.stats.successRate;
      return b.compositeScore - a.compositeScore;
    });

    // Assign 1-indexed ranks
    ranked.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    if (filter?.limit && filter.limit > 0) {
      return ranked.slice(0, filter.limit);
    }

    return ranked;
  }
}
