import Dexie, { type EntityTable } from 'dexie';
import indexedDB, { IDBKeyRange } from 'fake-indexeddb';
import type {
  UserProfile,
  PublisherProfile,
  PlaybookListing,
  PlaybookVersion,
  LicenseRecord,
  OrderRecord,
  ReviewRecord,
  CollectionRecord,
  BundleRecord,
  InstallationRecord,
  AuditLogEntry,
  WebhookEventRecord,
  ValidationRun
} from './types/marketplace';

export interface Project {
  id: string;
  name: string;
  description: string;
  type: 'WEB APP' | 'MOBILE API' | 'CLI TOOL' | 'OTHER';
  status: 'In Development' | 'Deployed' | 'Archived';
  createdAt: number;
  updatedAt: number;
}

export interface Skill {
  id: string;
  projectId: string;
  name: string;
  instructions: string;
  triggers: string[];
  examples: { input: string; output: string }[];
  tools: { webSearch: boolean; codeInterpreter: boolean };
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  projectId: string;
  lastActive: number;
  progress: number;
  context: string;
}

export interface ChatEntry {
  id: string;
  projectId: string;
  userPrompt: string;
  baseResponse: string;
  skillResponse: string;
  timestamp: number;
}

export interface Article {
  id: string;
  title: string;
  topic: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  language: string;
  mode: 'SEO' | 'AEO' | 'GEO' | 'SUPER_ENGINE';
  tone: string;
  wordCountTarget: number;
  content: string;
  outline: string[];
  metaData: {
    title: string;
    description: string;
    slug: string;
    canonicalUrl?: string;
  };
  schemaJson: string;
  scores: {
    seo: number;
    aeo: number;
    geo: number;
    overall: number;
  };
  auditChecklist: {
    hasDirectAnswer: boolean;
    hasTableData: boolean;
    hasEEATSignals: boolean;
    hasFaqSection: boolean;
    keywordDensityOk: boolean;
    schemaValid: boolean;
  };
  activeSuperpowers: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Superpower {
  id: string;
  name: string;
  repoUrl: string;
  description: string;
  instructions: string;
  category: 'SEO' | 'AEO' | 'GEO' | 'RESEARCH' | 'WRITING' | 'METHODOLOGY' | 'AGENT' | 'QUALITY';
  installedAt: number;
  enabled: boolean;
}

export interface PlaybookPermission {
  scope: string;
  level: 'read' | 'write' | 'execute' | 'admin';
  description: string;
}

export interface PlaybookFile {
  path: string;
  type: 'yaml' | 'md' | 'ts' | 'json';
  content: string;
  size: number;
}

export interface Playbook {
  id: string;
  title: string;
  slug: string;
  version: string;
  author: string;
  authorVerified: boolean;
  priceUsd: number;
  priceTokens: number;
  registrySource: string;
  registryName: string;
  description: string;
  category: 'DevOps' | 'Agentic Workflows' | 'Security Shield' | 'Code Quality' | 'Data Pipelines' | 'AI Testing' | 'Custom Tools';
  capabilities: string[];
  permissions: PlaybookPermission[];
  files: PlaybookFile[];
  sha256: string;
  signature: string;
  compatibility: {
    minEngineVersion: string;
    nodeVersion: string;
    os: string[];
  };
  rating: number;
  downloads: number;
  isInstalled: boolean;
  isInert: boolean;
  isActivated: boolean;
  isPaid: boolean;
  isOwned: boolean;
  licenseKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RegistrySource {
  id: string;
  name: string;
  url: string;
  isOfficial: boolean;
  isEnabled: boolean;
  status: 'online' | 'syncing' | 'offline';
  lastSyncedAt: number;
  packageCount: number;
  description: string;
}

export interface CacheBlob {
  hash: string;
  packageId: string;
  bytesSize: number;
  cachedAt: number;
  status: 'cached' | 'verified' | 'corrupted';
  integrityValid: boolean;
}

export interface LockfileEntry {
  packageId: string;
  name: string;
  version: string;
  sha256: string;
  registryUrl: string;
  activated: boolean;
  activationTime?: number;
  permissionsGranted: string[];
}

export interface Transaction {
  id: string;
  playbookId: string;
  playbookTitle: string;
  amount: number;
  currency: 'USD' | 'TOKENS';
  timestamp: number;
  status: 'Completed' | 'Refunded';
  licenseKey: string;
}

export interface PublisherListing {
  id: string;
  playbookName: string;
  version: string;
  priceUsd: number;
  category: string;
  status: 'Published' | 'Under Review' | 'Draft';
  downloads: number;
  revenue: number;
  createdAt: number;
}

let dexieOptions: import('dexie').DexieOptions | undefined = undefined;

if (typeof window === 'undefined') {
  dexieOptions = {
    indexedDB: indexedDB as unknown as IDBFactory,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    IDBKeyRange: IDBKeyRange as any
  };
}

const db = new Dexie('SkillaudeDB', dexieOptions) as Dexie & {
  projects: EntityTable<Project, 'id'>;
  skills: EntityTable<Skill, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  chats: EntityTable<ChatEntry, 'id'>;
  articles: EntityTable<Article, 'id'>;
  superpowers: EntityTable<Superpower, 'id'>;
  playbooks: EntityTable<Playbook, 'id'>;
  registries: EntityTable<RegistrySource, 'id'>;
  cacheBlobs: EntityTable<CacheBlob, 'hash'>;
  lockfiles: EntityTable<LockfileEntry, 'packageId'>;
  transactions: EntityTable<Transaction, 'id'>;
  publisherListings: EntityTable<PublisherListing, 'id'>;
  
  // Marketplace v5 Tables
  users: EntityTable<UserProfile, 'id'>;
  publishers: EntityTable<PublisherProfile, 'id'>;
  playbookListings: EntityTable<PlaybookListing, 'id'>;
  playbookVersions: EntityTable<PlaybookVersion, 'id'>;
  validationRuns: EntityTable<ValidationRun, 'id'>;
  licenses: EntityTable<LicenseRecord, 'id'>;
  orders: EntityTable<OrderRecord, 'id'>;
  reviews: EntityTable<ReviewRecord, 'id'>;
  collections: EntityTable<CollectionRecord, 'id'>;
  bundles: EntityTable<BundleRecord, 'id'>;
  installations: EntityTable<InstallationRecord, 'id'>;
  auditLogs: EntityTable<AuditLogEntry, 'id'>;
  webhooks: EntityTable<WebhookEventRecord, 'id'>;
};

db.version(1).stores({
  projects: 'id, name, updatedAt',
  skills: 'id, projectId, name, updatedAt',
  sessions: 'id, projectId, lastActive'
});

db.version(2).stores({
  projects: 'id, name, updatedAt',
  skills: 'id, projectId, name, updatedAt',
  sessions: 'id, projectId, lastActive',
  chats: 'id, projectId, timestamp'
});

db.version(3).stores({
  projects: 'id, name, updatedAt',
  skills: 'id, projectId, name, updatedAt',
  sessions: 'id, projectId, lastActive',
  chats: 'id, projectId, timestamp',
  articles: 'id, title, primaryKeyword, mode, updatedAt',
  superpowers: 'id, name, category, enabled, installedAt'
});

db.version(4).stores({
  projects: 'id, name, updatedAt',
  skills: 'id, projectId, name, updatedAt',
  sessions: 'id, projectId, lastActive',
  chats: 'id, projectId, timestamp',
  articles: 'id, title, primaryKeyword, mode, updatedAt',
  superpowers: 'id, name, category, enabled, installedAt',
  playbooks: 'id, title, category, registrySource, isInstalled, isActivated, isOwned, priceUsd',
  registries: 'id, name, isEnabled, isOfficial',
  cacheBlobs: 'hash, packageId',
  lockfiles: 'packageId, name, activated',
  transactions: 'id, playbookId, timestamp',
  publisherListings: 'id, status, createdAt'
});

db.version(5).stores({
  projects: 'id, name, updatedAt',
  skills: 'id, projectId, name, updatedAt',
  sessions: 'id, projectId, lastActive',
  chats: 'id, projectId, timestamp',
  articles: 'id, title, primaryKeyword, mode, updatedAt',
  superpowers: 'id, name, category, enabled, installedAt',
  playbooks: 'id, title, category, registrySource, isInstalled, isActivated, isOwned, priceUsd',
  registries: 'id, name, isEnabled, isOfficial',
  cacheBlobs: 'hash, packageId',
  lockfiles: 'packageId, name, activated',
  transactions: 'id, playbookId, timestamp',
  publisherListings: 'id, status, createdAt',
  
  // Marketplace v5 indices
  users: 'id, email, handle, role',
  publishers: 'id, handle, verified',
  playbookListings: 'id, slug, publisherHandle, category, isPaid, status, featured, ratingAverage',
  playbookVersions: 'id, playbookSlug, version, status, publishedAt',
  validationRuns: 'id, versionId, playbookSlug, passed',
  licenses: 'id, licenseKey, userId, playbookSlug, status',
  orders: 'id, userId, playbookId, status',
  reviews: 'id, playbookSlug, userId, rating',
  collections: 'id, slug, userId, isPublic',
  bundles: 'id, slug, publisherId',
  installations: 'id, userId, playbookSlug, activated',
  auditLogs: 'id, actorId, action, targetId, timestamp',
  webhooks: 'id, providerEventId, processed'
});

export { db };
