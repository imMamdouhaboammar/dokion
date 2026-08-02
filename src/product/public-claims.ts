import type { ProductSurfaceStatus } from "./types.ts";

export interface PublicClaimRecord {
  id: string;
  status: ProductSurfaceStatus;
  requiredMarker: string;
  productSurfaceId?: string;
  productSurfaceSection?: "commands" | "integrations" | "packs" | "registry";
}

export interface PublicClaimDocument {
  path: string;
  claims: PublicClaimRecord[];
}

export const PUBLIC_CLAIM_DOCUMENTS: readonly PublicClaimDocument[] = [
  {
    path: "README.md",
    claims: [
      {
        id: "runtime-active-playbook",
        status: "IMPLEMENTED",
        requiredMarker: "The runtime can validate and execute the active `.dokion/playbook.json`"
      },
      {
        id: "explicit-playbook-activation",
        status: "IMPLEMENTED",
        requiredMarker: "`dokion init` creates Dokion-owned state and `HARDENING.md`. It does not create or activate `.dokion/playbook.json`"
      },
      {
        id: "user-controlled-playbook-copy",
        status: "IMPLEMENTED",
        requiredMarker: "cp /path/to/reviewed-playbook.json .dokion/playbook.json"
      },
      {
        id: "secure-release",
        status: "PLANNED",
        requiredMarker: "The guided Secure Release Pack, exact proposal activation flow, and versioned Run Trace are planned",
        productSurfaceId: "secure-release",
        productSurfaceSection: "packs"
      },
      {
        id: "trace-command",
        status: "PLANNED",
        requiredMarker: "They are not current release features",
        productSurfaceId: "trace",
        productSurfaceSection: "commands"
      },
      {
        id: "verify-command",
        status: "PLANNED",
        requiredMarker: "`dokion verify` currently validates repository and Playbook contracts"
      },
      {
        id: "registry-installation",
        status: "UNAVAILABLE",
        requiredMarker: "Registry installation, activation, publishing, and Store behavior are unavailable",
        productSurfaceId: "package-install",
        productSurfaceSection: "registry"
      }
    ]
  },
  {
    path: "docs/getting-started/ONBOARDING.md",
    claims: [
      {
        id: "explicit-playbook-activation",
        status: "IMPLEMENTED",
        requiredMarker: "Initialization creates Dokion-owned state directories and `HARDENING.md`. It does not create or activate `.dokion/playbook.json`"
      },
      {
        id: "secure-release",
        status: "PLANNED",
        requiredMarker: "The Secure Release guided first run is planned, not implemented",
        productSurfaceId: "secure-release",
        productSurfaceSection: "packs"
      },
      {
        id: "trace-command",
        status: "PLANNED",
        requiredMarker: "The versioned Run Trace export is planned, not implemented",
        productSurfaceId: "trace",
        productSurfaceSection: "commands"
      },
      {
        id: "registry-activation",
        status: "UNAVAILABLE",
        requiredMarker: "Registry pull verifies and caches packages but does not install or activate them",
        productSurfaceId: "package-activation",
        productSurfaceSection: "registry"
      }
    ]
  },
  {
    path: "docs/launch/MARKETING_STRATEGY.md",
    claims: [
      {
        id: "current-supported-story",
        status: "IMPLEMENTED",
        requiredMarker: "User-authored Playbooks executed with declared order, permissions, approvals, state, findings, and evidence"
      },
      {
        id: "secure-release",
        status: "PLANNED",
        requiredMarker: "First planned guided journey",
        productSurfaceId: "secure-release",
        productSurfaceSection: "packs"
      },
      {
        id: "registry-publishing",
        status: "UNAVAILABLE",
        requiredMarker: "Registry installation, activation, publishing, ratings, or usage metrics",
        productSurfaceId: "package-publish",
        productSurfaceSection: "registry"
      }
    ]
  },
  {
    path: "docs/launch/public-beta-checklist.md",
    claims: [
      {
        id: "public-beta-readiness",
        status: "PLANNED",
        requiredMarker: "Current launch status: **NOT READY**"
      },
      {
        id: "active-authority",
        status: "IMPLEMENTED",
        requiredMarker: "`.dokion/playbook.json` is the sole execution authority"
      },
      {
        id: "registry-package-build",
        status: "IMPLEMENTED",
        requiredMarker: "Registry package build, read-only verification, and immutable artifact pull are implemented",
        productSurfaceId: "package-build",
        productSurfaceSection: "registry"
      },
      {
        id: "secure-release",
        status: "PLANNED",
        requiredMarker: "Secure Release passes clean-install positive and negative fixtures",
        productSurfaceId: "secure-release",
        productSurfaceSection: "packs"
      },
      {
        id: "trace-command",
        status: "PLANNED",
        requiredMarker: "Versioned Run Trace exports pass integrity, terminal-state, and unsafe-HTML tests",
        productSurfaceId: "trace",
        productSurfaceSection: "commands"
      }
    ]
  }
];

export const FORBIDDEN_UNQUALIFIED_PUBLIC_CLAIMS: readonly RegExp[] = [
  /multi-agent swarms/i,
  /bounded sub-agents/i,
  /automatic Git rollback/i,
  /empirical test verification/i,
  /autonomous, verified, multi-agent workflows/i
];
