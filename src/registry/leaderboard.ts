import { DokionError } from "../core/errors.ts";
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

/**
 * Temporary compatibility shell for the removed metrics leaderboard.
 *
 * Ranking cannot be restored until an approved telemetry contract defines
 * collection, deduplication, aggregation, abuse handling, retention, and
 * provenance for every displayed metric.
 */
export class DokionLeaderboardEngine {
  public calculateScore(
    _pkg: HubPlaybookPackage
  ): { compositeScore: number; scoreBreakdown: RankedLeaderboardEntry["scoreBreakdown"] } {
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Leaderboard scoring is unavailable because Dokion has no approved metrics or publisher-verification contract."
    );
  }

  public getLeaderboard(
    _packages: HubPlaybookPackage[],
    _filter?: LeaderboardFilter
  ): RankedLeaderboardEntry[] {
    throw new DokionError(
      "REGISTRY_NOT_IMPLEMENTED",
      "Leaderboard ranking is unavailable because Dokion has no approved metrics or publisher-verification contract."
    );
  }
}
