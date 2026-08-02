import { db } from '../db';
import type {
  PlaybookListing,
  PlaybookVersion,
  PublisherProfile,
  ReviewRecord,
  ValidationRun
} from '../types/marketplace';

export const INITIAL_PUBLISHERS: PublisherProfile[] = [
  {
    id: 'pub-dokion-official',
    handle: 'dokion',
    name: 'Dokion Core Team',
    verified: true,
    avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-01-core.svg',
    bio: 'Official Dokion security rulesets, analysis workflows, and core engine playbooks.',
    website: 'https://dokion.io',
    supportEmail: 'security@dokion.io',
    payoutStatus: 'active',
    commissionRate: 0,
    balanceCents: 1540000,
    totalSalesCents: 4500000,
    totalDownloads: 18450,
    createdAt: Date.now() - 86400000 * 365,
    updatedAt: Date.now()
  },
  {
    id: 'pub-cybershield-01',
    handle: 'cybershield',
    name: 'CyberShield Security Labs',
    verified: true,
    avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-04-guardian.svg',
    bio: 'Specialized enterprise security scanning playbooks, OWASP Top 10 rule engines, and cloud compliance rules.',
    website: 'https://cybershieldlabs.io',
    supportEmail: 'contact@cybershieldlabs.io',
    payoutStatus: 'active',
    commissionRate: 0.12,
    balanceCents: 320000,
    totalSalesCents: 1250000,
    totalDownloads: 4820,
    createdAt: Date.now() - 86400000 * 180,
    updatedAt: Date.now()
  },
  {
    id: 'pub-devops-craft',
    handle: 'devopscraft',
    name: 'DevOps Craft Collective',
    verified: true,
    avatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-03-terminal.svg',
    bio: 'CI/CD pipeline analysis, Docker/Kubernetes config review, and IaC vulnerability detection.',
    website: 'https://devopscraft.dev',
    supportEmail: 'support@devopscraft.dev',
    payoutStatus: 'active',
    commissionRate: 0.12,
    balanceCents: 185000,
    totalSalesCents: 780000,
    totalDownloads: 2910,
    createdAt: Date.now() - 86400000 * 120,
    updatedAt: Date.now()
  }
];

export const INITIAL_PLAYBOOKS: PlaybookListing[] = [
  {
    id: 'pb-secure-api-review',
    slug: 'secure-api-review',
    idDomain: 'com.dokion.secure-api-review',
    title: 'Secure API Review & OWASP Compliance',
    summary: 'Comprehensive REST API security analysis playbook inspecting authentication, authorization, and rate limiting.',
    description: `The **Secure API Review** playbook performs deep static and dynamic inspection of OpenAPI, GraphQL, and REST API implementations. It scans endpoints for broken object level authorization (BOLA), sensitive data exposure, missing rate limits, and weak JWT verification routines.

### Key Capabilities
- **BOLA & BFLA Detection**: Automated endpoint mapping to detect missing authorization checks.
- **JWT & Auth Token Inspection**: Validates signature algorithm requirements and expiration handling.
- **Input Sanitization**: Detects SQL injection, Command Injection, and SSRF vulnerabilities.
- **Dokion Findings Protocol**: Generates structured, actionable remediation reports conforming to schema v1.`,
    iconUrl: '/dokion-mascot-full-set/mascot/color/dokion-04-guardian.svg',
    publisherId: 'pub-dokion-official',
    publisherHandle: 'dokion',
    publisherName: 'Dokion Core Team',
    publisherVerified: true,
    category: 'APIs',
    tags: ['api-security', 'owasp', 'rest', 'graphql', 'auth'],
    isPaid: false,
    priceUsdCents: 0,
    priceTokens: 0,
    licenseType: 'Apache-2.0',
    currentVersion: '1.2.0',
    featured: true,
    isOfficial: true,
    ratingAverage: 4.9,
    ratingCount: 38,
    downloadCount: 8420,
    saveCount: 1240,
    lastVerifiedAt: Date.now() - 86400000 * 2,
    status: 'PUBLISHED',
    createdAt: Date.now() - 86400000 * 90,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'pb-secrets-detector-pro',
    slug: 'secrets-detector-pro',
    idDomain: 'io.cybershield.secrets-detector-pro',
    title: 'Secrets & Credential Scanner Pro',
    summary: 'High-entropy credential scanner detecting leaked API keys, tokens, SSH keys, and cloud credentials.',
    description: `**Secrets & Credential Scanner Pro** detects over 150+ secret types across source code, git history, configuration files, and environment templates. Built with custom high-entropy validation algorithms to eliminate false positives.

### Supported Secret Types
- AWS Access Keys & Secret Keys
- Stripe, OpenAI, and Anthropic API Tokens
- OAuth Client Secrets & Private Keys
- Database Connection Strings & JDBC URIs`,
    iconUrl: '/dokion-mascot-full-set/mascot/color/dokion-02-reviewer.svg',
    publisherId: 'pub-cybershield-01',
    publisherHandle: 'cybershield',
    publisherName: 'CyberShield Security Labs',
    publisherVerified: true,
    category: 'Secrets Detection',
    tags: ['secrets', 'credentials', 'git-scan', 'security', 'compliance'],
    isPaid: true,
    priceUsdCents: 2900, // $29.00
    priceTokens: 290,
    licenseType: 'Commercial',
    currentVersion: '2.1.0',
    featured: true,
    isOfficial: false,
    ratingAverage: 4.8,
    ratingCount: 24,
    downloadCount: 2150,
    saveCount: 680,
    lastVerifiedAt: Date.now() - 86400000 * 1,
    status: 'PUBLISHED',
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 1
  },
  {
    id: 'pb-cloud-infra-shield',
    slug: 'cloud-infra-shield',
    idDomain: 'dev.devopscraft.cloud-infra-shield',
    title: 'Cloud Infra & IaC Security Shield',
    summary: 'Terraform, Helm, and CloudFormation static analysis playbook detecting misconfigurations and public bucket exposures.',
    description: `Audit infrastructure-as-code files before deployment. Flags permissive S3 buckets, unencrypted EBS volumes, overly broad IAM wildcards, and exposed Kubernetes API servers.`,
    iconUrl: '/dokion-mascot-full-set/mascot/color/dokion-03-terminal.svg',
    publisherId: 'pub-devops-craft',
    publisherHandle: 'devopscraft',
    publisherName: 'DevOps Craft Collective',
    publisherVerified: true,
    category: 'Cloud Security',
    tags: ['terraform', 'iac', 'aws', 'kubernetes', 'cloud'],
    isPaid: true,
    priceUsdCents: 4900, // $49.00
    priceTokens: 490,
    licenseType: 'Commercial',
    currentVersion: '1.0.4',
    featured: false,
    isOfficial: false,
    ratingAverage: 4.7,
    ratingCount: 16,
    downloadCount: 1280,
    saveCount: 420,
    lastVerifiedAt: Date.now() - 86400000 * 3,
    status: 'PUBLISHED',
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 3
  }
];

export const INITIAL_VERSIONS: PlaybookVersion[] = [
  {
    id: 'ver-secure-api-review-120',
    playbookId: 'pb-secure-api-review',
    playbookSlug: 'secure-api-review',
    version: '1.2.0',
    changelog: 'Added GraphQL schema introspection audit, improved JWT verification rules, updated findings protocol to v1.',
    readme: `# Secure API Review
Official Dokion Playbook for API security auditing.

## Usage
\`\`\`bash
dokion playbook install secure-api-review
\`\`\``,
    packageUrl: 'https://registry.dokion.io/packages/secure-api-review-1.2.0.tgz',
    sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    packageSizeBytes: 1420500,
    status: 'PUBLISHED',
    compatibility: {
      dokion: '>=1.8.0 <2.0.0',
      operatingSystems: ['linux', 'macos', 'windows'],
      runtimes: ['node', 'python']
    },
    permissions: [
      {
        type: 'filesystem',
        scope: 'project',
        level: 'read',
        description: 'Read API route definitions and schema files.',
        required: true
      },
      {
        type: 'filesystem',
        scope: '.dokion/reports',
        level: 'write',
        description: 'Write audit findings report.',
        required: true
      }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1024,
        content: `schema_version: 1\nid: com.dokion.secure-api-review\nname: Secure API Review\nversion: 1.2.0`
      },
      {
        path: 'schemas/input.schema.json',
        type: 'json',
        size: 512,
        content: `{\n  "$schema": "http://json-schema.org/draft-07/schema#",\n  "type": "object"\n}`
      },
      {
        path: 'rules/api_rules.yaml',
        type: 'yaml',
        size: 2048,
        content: `rules:\n  - id: bola-001\n    severity: HIGH`
      }
    ],
    validationPassed: true,
    lastTestedAt: Date.now() - 86400000 * 2,
    publishedAt: Date.now() - 86400000 * 2,
    createdAt: Date.now() - 86400000 * 5
  }
];

export const INITIAL_VALIDATION_RUNS: ValidationRun[] = [
  {
    id: 'val-run-001',
    versionId: 'ver-secure-api-review-120',
    playbookSlug: 'secure-api-review',
    passed: true,
    steps: [
      { step: 'manifest', status: 'passed', message: 'Manifest schema version 1 valid.', executionTimeMs: 12 },
      { step: 'archive', status: 'passed', message: 'No directory traversal or zip bomb detected.', executionTimeMs: 45 },
      { step: 'static_analysis', status: 'passed', message: 'Zero prohibited executable calls found.', executionTimeMs: 120 },
      { step: 'dependency', status: 'passed', message: 'All dependencies verified clean.', executionTimeMs: 85 },
      { step: 'secrets', status: 'passed', message: 'Zero hardcoded credentials found.', executionTimeMs: 60 },
      { step: 'malware', status: 'passed', message: 'ClamAV signature scan clear.', executionTimeMs: 310 },
      { step: 'isolated_test', status: 'passed', message: 'Test suite passed in isolated runner environment.', executionTimeMs: 1450 },
      { step: 'findings_protocol', status: 'passed', message: 'Output conforms strictly to dokion-findings protocol v1.', executionTimeMs: 30 }
    ],
    ranAt: Date.now() - 86400000 * 2,
    environment: 'dokion-runner-sandbox-v1'
  }
];

export const INITIAL_REVIEWS: ReviewRecord[] = [
  {
    id: 'rev-001',
    playbookId: 'pb-secure-api-review',
    playbookSlug: 'secure-api-review',
    userId: 'usr-member-01',
    userName: 'Alex Vance',
    userAvatarUrl: '/dokion-mascot-full-set/mascot/color/dokion-03-terminal.svg',
    verifiedOwner: true,
    rating: 5,
    title: 'Caught BOLA vulnerability in production API routes!',
    content: 'Ran this playbook against our Express microservice suite. Found two missing permission middleware checks that automated unit tests missed. Excellent findings report format.',
    helpfulVotes: 14,
    creatorResponse: {
      content: 'Thanks Alex! Glad the BOLA rules caught those issues before production deployment.',
      respondedAt: Date.now() - 86400000 * 10
    },
    moderated: false,
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 14
  }
];

export async function seedMarketplaceDatabase() {
  const existing = await db.playbookListings.count();
  if (existing === 0) {
    await db.publishers.bulkPut(INITIAL_PUBLISHERS);
    await db.playbookListings.bulkPut(INITIAL_PLAYBOOKS);
    await db.playbookVersions.bulkPut(INITIAL_VERSIONS);
    await db.validationRuns.bulkPut(INITIAL_VALIDATION_RUNS);
    await db.reviews.bulkPut(INITIAL_REVIEWS);
  }
}
