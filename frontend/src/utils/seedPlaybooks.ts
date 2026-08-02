import { db, Playbook, RegistrySource } from '../db';

export const INITIAL_REGISTRIES: RegistrySource[] = [
  {
    id: 'reg-dokion-official',
    name: 'Dokion Official Registry',
    url: 'https://registry.dokion.io',
    isOfficial: true,
    isEnabled: true,
    status: 'online',
    lastSyncedAt: Date.now() - 1000 * 60 * 12,
    packageCount: 148,
    description: 'The primary cryptographically signed, verified Registry maintained by the core Dokion team.'
  },
  {
    id: 'reg-github-official',
    name: 'Dokion GitHub Repository',
    url: 'https://github.com/imMamdouhaboammar/dokion',
    isOfficial: true,
    isEnabled: true,
    status: 'online',
    lastSyncedAt: Date.now() - 1000 * 60 * 5,
    packageCount: 92,
    description: 'Official open-source playbooks, skills, and execution specs from github.com/imMamdouhaboammar/dokion.'
  },
  {
    id: 'reg-community-dev',
    name: 'Dokion Community Hub',
    url: 'https://registry.community.dokion.dev',
    isOfficial: false,
    isEnabled: true,
    status: 'online',
    lastSyncedAt: Date.now() - 1000 * 60 * 45,
    packageCount: 320,
    description: 'Vetted community playbooks submitted by independent developers and prompt engineers worldwide.'
  }
];

export const INITIAL_PLAYBOOKS: Playbook[] = [
  {
    id: 'pb-cloud-deployer',
    title: 'Dokion Cloud Run & Container Deployer',
    slug: 'dokion-cloud-deployer',
    version: '2.4.0',
    author: '@imMamdouhaboammar',
    authorVerified: true,
    priceUsd: 0,
    priceTokens: 0,
    registrySource: 'https://github.com/imMamdouhaboammar/dokion',
    registryName: 'Dokion GitHub Repository',
    description: 'Automated container builds, health checks, domain mapping, and zero-downtime Cloud Run deployments with rollbacks.',
    category: 'DevOps',
    capabilities: ['TERMINAL_EXEC', 'NET_PROXY', 'SECRETS_ACCESS', 'FILE_ACCESS'],
    permissions: [
      { scope: 'net:cloudrun.googleapis.com', level: 'write', description: 'Deploy and manage Cloud Run container services' },
      { scope: 'exec:docker', level: 'execute', description: 'Build and tag container images locally' },
      { scope: 'read:.env', level: 'read', description: 'Read deployment configuration secrets' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1420,
        content: `name: dokion-cloud-deployer
version: 2.4.0
author: "@imMamdouhaboammar"
description: "Deploy fullstack applications to Cloud Run"
engine: ">=1.2.0"
steps:
  - name: Build Production Bundle
    run: npm run build
  - name: Verify Health Check
    run: curl -f http://localhost:3000/api/health
  - name: Containerize & Push
    run: gcloud run deploy dokion-app --source .
`
      },
      {
        path: 'SKILL.md',
        type: 'md',
        size: 980,
        content: `# Dokion Cloud Deployer Skill
When requested to deploy, compile static assets, run health check on port 3000, and push to container registry with zero downtime.`
      }
    ],
    sha256: 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    signature: 'ed25519:sig_dokion_official_deployer_v240_984f1029c',
    compatibility: {
      minEngineVersion: 'v1.2.0',
      nodeVersion: '>=18.0.0',
      os: ['linux', 'darwin']
    },
    rating: 4.9,
    downloads: 1420,
    isInstalled: true,
    isInert: false,
    isActivated: true,
    isPaid: false,
    isOwned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2
  },
  {
    id: 'pb-code-auditor',
    title: 'Dokion Gemini Agentic Code Auditor',
    slug: 'dokion-code-auditor',
    version: '1.8.5',
    author: '@imMamdouhaboammar',
    authorVerified: true,
    priceUsd: 0,
    priceTokens: 0,
    registrySource: 'https://github.com/imMamdouhaboammar/dokion',
    registryName: 'Dokion GitHub Repository',
    description: 'Deep static analysis, type-safety checks, unslop anti-pattern preflight audits, and structural vulnerability scans.',
    category: 'Code Quality',
    capabilities: ['FILE_ACCESS', 'SUBAGENT_DISPATCH', 'AST_GRAPH'],
    permissions: [
      { scope: 'read:workspace', level: 'read', description: 'Inspect local source code tree' },
      { scope: 'exec:unslop-preflight', level: 'execute', description: 'Run unslop preflight audit CLI' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1150,
        content: `name: dokion-code-auditor
version: 1.8.5
author: "@imMamdouhaboammar"
capabilities:
  - FILE_ACCESS
  - SUBAGENT_DISPATCH
rules:
  - audit-type-safety
  - audit-unslop-gates
  - audit-accessibility
`
      },
      {
        path: 'auditor.ts',
        type: 'ts',
        size: 2100,
        content: `export async function auditWorkspace() {\n  console.log("Running Dokion Root Cause Mode audit...");\n}`
      }
    ],
    sha256: 'sha256:5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    signature: 'ed25519:sig_dokion_github_auditor_v185_7731ab',
    compatibility: {
      minEngineVersion: 'v1.0.0',
      nodeVersion: '>=18.0.0',
      os: ['linux', 'darwin', 'win32']
    },
    rating: 5.0,
    downloads: 2890,
    isInstalled: true,
    isInert: false,
    isActivated: true,
    isPaid: false,
    isOwned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    updatedAt: Date.now() - 1000 * 60 * 60 * 5
  },
  {
    id: 'pb-subagent-pro',
    title: 'Dokion Subagent Orchestrator Pro',
    slug: 'dokion-subagent-pro',
    version: '3.1.2',
    author: '@dokion-enterprise',
    authorVerified: true,
    priceUsd: 19,
    priceTokens: 190,
    registrySource: 'https://registry.dokion.io',
    registryName: 'Dokion Official Registry',
    description: 'Coordinate parallel subagents, task DAG delegation, real-time message bus streaming, and deadlock resolution.',
    category: 'Agentic Workflows',
    capabilities: ['SUBAGENT_DISPATCH', 'PARALLEL_EXEC', 'MEMORY_BUS'],
    permissions: [
      { scope: 'dispatch:subagent', level: 'execute', description: 'Spawn and terminate subagent workers' },
      { scope: 'write:task-bus', level: 'write', description: 'Broadcast events on memory bus' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1680,
        content: `name: dokion-subagent-pro
version: 3.1.2
author: "@dokion-enterprise"
max_concurrent_agents: 8
memory_bus_channel: "dokion-tasks"
`
      }
    ],
    sha256: 'sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    signature: 'ed25519:sig_dokion_subagent_pro_v312_bb491',
    compatibility: {
      minEngineVersion: 'v1.4.0',
      nodeVersion: '>=20.0.0',
      os: ['linux', 'darwin']
    },
    rating: 4.8,
    downloads: 940,
    isInstalled: false,
    isInert: true,
    isActivated: false,
    isPaid: true,
    isOwned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12
  },
  {
    id: 'pb-security-shield',
    title: 'Dokion Zero-Trust Security & Secrets Guard',
    slug: 'dokion-security-shield',
    version: '1.2.0',
    author: '@secops-lead',
    authorVerified: true,
    priceUsd: 29,
    priceTokens: 290,
    registrySource: 'https://registry.dokion.io',
    registryName: 'Dokion Official Registry',
    description: 'Sanitizes environment variables, prevents token leaks in logs, masks PII data, and enforces strict boundary rules.',
    category: 'Security Shield',
    capabilities: ['SECRETS_ACCESS', 'PERMISSION_GUARD', 'AUDIT_LOGS'],
    permissions: [
      { scope: 'guard:secrets', level: 'admin', description: 'Intercept and redact raw tokens' },
      { scope: 'audit:system-calls', level: 'read', description: 'Monitor system call security flags' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1890,
        content: `name: dokion-security-shield
version: 1.2.0
author: "@secops-lead"
redact_patterns:
  - "GEMINI_API_KEY"
  - "STRIPE_SECRET_KEY"
  - "DATABASE_URL"
`
      }
    ],
    sha256: 'sha256:cb5a075438840d5e165d6c8e54705596b6b5557297e59c07248b61c8f1e00a9d',
    signature: 'ed25519:sig_dokion_sec_shield_v120_8841a',
    compatibility: {
      minEngineVersion: 'v1.1.0',
      nodeVersion: '>=18.0.0',
      os: ['linux', 'darwin', 'win32']
    },
    rating: 4.9,
    downloads: 610,
    isInstalled: false,
    isInert: true,
    isActivated: false,
    isPaid: true,
    isOwned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    updatedAt: Date.now() - 1000 * 60 * 60 * 18
  },
  {
    id: 'pb-data-pipeline',
    title: 'Dokion Data Pipeline & Postgres ETL Engine',
    slug: 'dokion-data-pipeline',
    version: '2.0.1',
    author: '@data-engineers',
    authorVerified: false,
    priceUsd: 0,
    priceTokens: 0,
    registrySource: 'https://registry.community.dokion.dev',
    registryName: 'Dokion Community Hub',
    description: 'Automated schema migrations, batch stream transformations, CSV/JSON ingest, and Drizzle/Prisma sync.',
    category: 'Data Pipelines',
    capabilities: ['NET_PROXY', 'FILE_ACCESS', 'DATABASE_CONNECTOR'],
    permissions: [
      { scope: 'net:postgres', level: 'write', description: 'Execute DML and DDL migrations' },
      { scope: 'read:data-files', level: 'read', description: 'Parse local CSV and JSON payload files' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1340,
        content: `name: dokion-data-pipeline
version: 2.0.1
author: "@data-engineers"
batch_size: 1000
`
      }
    ],
    sha256: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    signature: 'ed25519:sig_dokion_community_etl_9921',
    compatibility: {
      minEngineVersion: 'v1.0.0',
      nodeVersion: '>=18.0.0',
      os: ['linux', 'darwin', 'win32']
    },
    rating: 4.7,
    downloads: 1150,
    isInstalled: false,
    isInert: true,
    isActivated: false,
    isPaid: false,
    isOwned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 30
  },
  {
    id: 'pb-e2e-testing',
    title: 'Dokion Automated E2E & Visual QA Suite',
    slug: 'dokion-e2e-testing',
    version: '1.5.0',
    author: '@qa-masters',
    authorVerified: true,
    priceUsd: 15,
    priceTokens: 150,
    registrySource: 'https://github.com/imMamdouhaboammar/dokion',
    registryName: 'Dokion GitHub Repository',
    description: 'Headless browser flow recorder, keyboard navigation checker, mobile layout viewport stress test, and WCAG accessibility audit.',
    category: 'AI Testing',
    capabilities: ['TERMINAL_EXEC', 'BROWSER_AUTOMATION', 'FILE_ACCESS'],
    permissions: [
      { scope: 'exec:playwright', level: 'execute', description: 'Launch headless Chromium browser' },
      { scope: 'write:test-reports', level: 'write', description: 'Output test score JSON and screenshots' }
    ],
    files: [
      {
        path: 'playbook.yaml',
        type: 'yaml',
        size: 1510,
        content: `name: dokion-e2e-testing
version: 1.5.0
author: "@qa-masters"
viewport_widths: [375, 768, 1280]
`
      }
    ],
    sha256: 'sha256:a8f05f54d380d8c0b47db9591461f36471e4d3c32938148483cfd38962078519',
    signature: 'ed25519:sig_dokion_qa_v150_c112',
    compatibility: {
      minEngineVersion: 'v1.3.0',
      nodeVersion: '>=18.0.0',
      os: ['linux', 'darwin']
    },
    rating: 4.9,
    downloads: 820,
    isInstalled: false,
    isInert: true,
    isActivated: false,
    isPaid: true,
    isOwned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    updatedAt: Date.now() - 1000 * 60 * 60 * 8
  }
];

export async function ensureSeedData() {
  try {
    const registryCount = await db.registries.count();
    if (registryCount === 0) {
      await db.registries.bulkAdd(INITIAL_REGISTRIES);
    }

    const playbookCount = await db.playbooks.count();
    if (playbookCount === 0) {
      await db.playbooks.bulkAdd(INITIAL_PLAYBOOKS);

      // Seed cache blobs for installed playbooks
      for (const pb of INITIAL_PLAYBOOKS.filter(p => p.isInstalled)) {
        await db.cacheBlobs.put({
          hash: pb.sha256,
          packageId: pb.id,
          bytesSize: pb.files.reduce((acc, f) => acc + f.size, 0),
          cachedAt: Date.now() - 1000 * 60 * 60 * 2,
          status: 'verified',
          integrityValid: true
        });

        await db.lockfiles.put({
          packageId: pb.id,
          name: pb.title,
          version: pb.version,
          sha256: pb.sha256,
          registryUrl: pb.registrySource,
          activated: pb.isActivated,
          activationTime: pb.isActivated ? Date.now() - 1000 * 60 * 60 * 2 : undefined,
          permissionsGranted: pb.permissions.map(p => p.scope)
        });
      }
    }
  } catch (err) {
    console.error('Failed to initialize Dokion seed data:', err);
  }
}
