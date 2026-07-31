export type PlaybookCategory =
  | "ui-ux"
  | "security"
  | "backend"
  | "devops"
  | "ai-slop-remediation"
  | "testing"
  | "general";

export interface PublisherProfile {
  handle: string;
  name: string;
  verified: boolean;
  trustScore: number; // 0 to 100
  avatarUrl?: string;
}

export interface PackageStats {
  downloads: number;
  activeInstalls: number;
  rating: number; // 1.0 to 5.0
  ratingsCount: number;
  successRate: number; // Percentage e.g. 98.5
}

export interface HubPlaybookPackage {
  id: string; // e.g. "amElnagdy/ui-review-loop"
  name: string;
  version: string;
  description: string;
  category: PlaybookCategory;
  tags: string[];
  publisher: PublisherProfile;
  digest: string; // SHA-256 hash of playbook content
  playbookUrl: string;
  stats: PackageStats;
  createdAt: string;
  updatedAt: string;
}

export interface RatingRecord {
  packageId: string;
  userHandle: string;
  rating: number; // 1 to 5
  review?: string;
  timestamp: string;
}

export interface ForkLineage {
  parentPackageId: string;
  parentDigest: string;
  parentVersion: string;
  forkAuthor: string;
  forkedAt: string;
}

export interface LeaderboardFilter {
  category?: PlaybookCategory;
  minRating?: number;
  verifiedOnly?: boolean;
  sortBy?: "downloads" | "rating" | "successRate" | "score";
  limit?: number;
}
