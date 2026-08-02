export type UserRole = 'GUEST' | 'MEMBER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  handle: string;
  avatarUrl: string;
  role: UserRole;
  publisherId?: string;
  bio?: string;
  website?: string;
  githubHandle?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublisherProfile {
  id: string;
  handle: string;
  name: string;
  verified: boolean;
  avatarUrl: string;
  bio: string;
  website: string;
  supportEmail: string;
  payoutStatus: 'unconfigured' | 'pending' | 'active' | 'suspended';
  commissionRate: number; // e.g. 0.10 for 10%
  balanceCents: number; // integer minor units
  totalSalesCents: number;
  totalDownloads: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlaybookPermission {
  type: 'filesystem' | 'network' | 'shell' | 'env' | 'secrets';
  scope: string;
  level: 'read' | 'write' | 'execute' | 'admin';
  description: string;
  required: boolean;
}

export interface PlaybookFileNode {
  path: string;
  type: 'yaml' | 'yml' | 'json' | 'md' | 'ts' | 'js' | 'py' | 'sh' | 'dir';
  size: number;
  content?: string;
  children?: PlaybookFileNode[];
}

export interface CompatibilityRules {
  dokion: string; // semver range, e.g. ">=1.8.0 <2.0.0"
  operatingSystems: ('linux' | 'macos' | 'windows')[];
  runtimes: ('node' | 'python' | 'bun' | 'go' | 'rust')[];
}

export type ModerationStatus =
  | 'DRAFT'
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VALIDATION_FAILED'
  | 'READY_FOR_SUBMISSION'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUSPENDED'
  | 'DEPRECATED'
  | 'ARCHIVED';

export interface ValidationStepResult {
  step: 'manifest' | 'archive' | 'static_analysis' | 'dependency' | 'secrets' | 'malware' | 'isolated_test' | 'findings_protocol';
  status: 'passed' | 'failed' | 'warning' | 'not_run';
  message: string;
  details?: string[];
  executionTimeMs?: number;
}

export interface ValidationRun {
  id: string;
  versionId: string;
  playbookSlug: string;
  passed: boolean;
  steps: ValidationStepResult[];
  ranAt: number;
  environment: string;
}

export interface PlaybookVersion {
  id: string;
  playbookId: string;
  playbookSlug: string;
  version: string; // e.g. "1.0.0"
  changelog: string;
  readme: string;
  packageUrl: string;
  sha256: string;
  packageSizeBytes: number;
  status: ModerationStatus;
  compatibility: CompatibilityRules;
  permissions: PlaybookPermission[];
  files: PlaybookFileNode[];
  validationRunId?: string;
  validationPassed: boolean;
  lastTestedAt?: number;
  publishedAt?: number;
  createdAt: number;
}

export interface PlaybookListing {
  id: string;
  slug: string;
  idDomain: string; // e.g. com.dokion.security-api-review
  title: string;
  summary: string;
  description: string;
  iconUrl: string;
  publisherId: string;
  publisherHandle: string;
  publisherName: string;
  publisherVerified: boolean;
  category: string;
  tags: string[];
  isPaid: boolean;
  priceUsdCents: number; // integer minor units, 0 for free
  priceTokens: number;
  licenseType: string; // e.g. "commercial", "MIT", "Apache-2.0"
  currentVersion: string; // e.g. "1.0.0"
  featured: boolean;
  isOfficial: boolean;
  ratingAverage: number; // real calculated rating
  ratingCount: number; // real review count
  downloadCount: number; // real installation/download count
  saveCount: number;
  lastVerifiedAt?: number;
  status: ModerationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface LicenseRecord {
  id: string;
  licenseKey: string;
  userId: string;
  playbookId: string;
  playbookSlug: string;
  version: string;
  orderId?: string;
  seats: number;
  status: 'active' | 'revoked' | 'expired';
  expiresAt?: number;
  createdAt: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  playbookId: string;
  playbookTitle: string;
  amountCents: number;
  currency: 'USD' | 'TOKENS';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentProvider: 'stripe_test' | 'dokion_tokens' | 'free_entitlement';
  providerTransactionId: string;
  licenseKey: string;
  createdAt: number;
}

export interface ReviewRecord {
  id: string;
  playbookId: string;
  playbookSlug: string;
  userId: string;
  userName: string;
  userAvatarUrl: string;
  verifiedOwner: boolean;
  rating: number; // 1 to 5
  title: string;
  content: string;
  helpfulVotes: number;
  creatorResponse?: {
    content: string;
    respondedAt: number;
  };
  revisions?: {
    content: string;
    rating: number;
    updatedAt: number;
  }[];
  moderated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  userId: string;
  userName: string;
  isPublic: boolean;
  playbookIds: string[];
  likeCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface BundleRecord {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publisherId: string;
  playbookIds: string[];
  priceUsdCents: number;
  discountPercentage: number;
  createdAt: number;
}

export interface InstallationRecord {
  id: string;
  userId: string;
  playbookId: string;
  playbookSlug: string;
  installedVersion: string;
  sha256: string;
  activated: boolean;
  permissionsGranted: string[];
  installedAt: number;
  lastCheckAt: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  targetType: 'playbook' | 'version' | 'user' | 'order' | 'review' | 'system';
  targetId: string;
  details: string;
  ipAddress?: string;
  timestamp: number;
}

export interface WebhookEventRecord {
  id: string;
  providerEventId: string;
  eventType: string;
  processed: boolean;
  payload: Record<string, unknown>;
  receivedAt: number;
}
