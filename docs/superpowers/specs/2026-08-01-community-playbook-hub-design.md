# Dokion Community Playbook Hub & Registry — Architectural Design

**Spec Date:** 2026-08-01  
**Status:** Approved for Implementation  
**Target:** Production-Grade Community Playbook Hub & Telemetry Runtime  

---

## 1. Executive Overview

Dokion is the premier **Playbooks Engineering Runtime for AI Coding Agents**. While Dokion ships with core built-in playbooks, software engineering workflows evolve rapidly across domains (UI/UX, Security, Backend, AI Slop Remediation, Mobile).

The **Community Playbook Hub & Registry** establishes a decentralized, verified, and telemetry-backed marketplace where engineers and AI coding agents can:
1. **Discover & Pull**: Search, inspect, and pull verified community playbooks (`dokion playbooks pull <owner/playbook>`).
2. **Fork & Adapt**: Clone community playbooks into inert local proposals, customize them, and merge local updates (`dokion playbooks fork`, `dokion playbooks merge`).
3. **Publish & Share**: Cryptographically sign (SHA-256) and publish custom playbooks (`dokion playbooks publish`).
4. **Telemetry & Leaderboard**: Track anonymous execution success rates, active installs, downloads, and rank playbooks via a dynamic Leaderboard algorithm (`dokion playbooks leaderboard`).

---

## 2. System Architecture & Components

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                           DOKION PLAYBOOK HUB & REGISTRY SYSTEM                           │
└─────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────────────┐      ┌──────────────────────────┐      ┌──────────────────────────┐
│ REGISTRY ENGINE          │      │ TELEMETRY ENGINE         │      │ LEADERBOARD & RANKING    │
├──────────────────────────┤      ├──────────────────────────┤      ├──────────────────────────┤
│ • Index & Search         │      │ • Opt-In Event Tracking  │      │ • Dynamic Composite Score│
│ • Local & Remote Cache   │      │ • Local Spooling         │      │ • Download Metrics       │
│ • Cryptographic SHA-256  │      │ • Success/Failure Rates  │      │ • Verified Badges        │
│ • Fork & Merge Lineage   │      │ • Anonymized UUIDs       │      │ • Category Filters       │
└──────────────────────────┘      └──────────────────────────┘      └──────────────────────────┘
```

### 2.1 Core Modules

1. **`src/registry/hub.ts`**: Main Registry Client managing remote fetching, local caching, search indexing, and package resolution.
2. **`src/registry/types.ts`**: Schema types for `HubPlaybookPackage`, `PublisherProfile`, `RatingRecord`, `LeaderboardEntry`, `ForkLineage`.
3. **`src/registry/leaderboard.ts`**: Dynamic ranking score calculator evaluating downloads, success rate, user ratings, and verified publisher status.
4. **`src/registry/fork-merge.ts`**: Lineage-aware forking and merging engine for customizing community playbooks.
5. **`src/telemetry/index.ts` & `src/telemetry/client.ts`**: Privacy-first, opt-in event spooler tracking downloads, execution turns, step failures, and completion verification.
6. **`src/cli/handlers/hub.ts`**: CLI command dispatcher for `dokion playbooks hub|search|pull|publish|leaderboard|rate|fork|merge`.

---

## 3. Data Schema Contracts

### 3.1 `HubPlaybookPackage` Interface
```typescript
export interface HubPlaybookPackage {
  id: string; // e.g. "amElnagdy/ui-review-loop"
  name: string;
  version: string;
  description: string;
  category: "ui-ux" | "security" | "backend" | "devops" | "ai-slop-remediation" | "testing" | "general";
  tags: string[];
  publisher: {
    handle: string;
    verified: boolean;
    trustScore: number;
  };
  digest: string; // SHA-256 digest of playbook.json
  playbookUrl: string;
  stats: {
    downloads: number;
    activeInstalls: number;
    rating: number; // 1.0 to 5.0
    ratingsCount: number;
    successRate: number; // percentage e.g. 98.4
  };
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Telemetry Event Schema
```typescript
export interface TelemetryEvent {
  eventId: string;
  eventType: "PLAYBOOK_PULLED" | "PLAYBOOK_EXECUTED" | "STEP_FAILED" | "RUN_COMPLETED";
  playbookId: string;
  digest: string;
  timestamp: string;
  anonymousSessionId: string;
  durationMs?: number;
  success?: boolean;
}
```

---

## 4. Ranking & Leaderboard Algorithm

The Leaderboard computes a composite score $S$ for every community playbook:

$$S = \Big(W_d \times \log_{10}(D + 1)\Big) + \Big(W_r \times R\Big) + \Big(W_s \times \frac{\text{SuccessRate}}{100}\Big) + B_v$$

Where:
- $D$: Total verified downloads ($W_d = 25$)
- $R$: Average star rating 1–5 ($W_r = 15$)
- $\text{SuccessRate}$: Execution completion rate ($W_s = 40$)
- $B_v$: Verified Publisher Bonus ($+20$ points)

---

## 5. Security & Authority Guarantees

1. **Inert Pull Policy**: Pulled community playbooks are saved as `.dokion/playbook.proposed.json`. They **NEVER** overwrite the active `.dokion/playbook.json` without explicit user activation (`dokion playbooks sync` or manual copy).
2. **Cryptographic Verification**: Every pulled playbook's SHA-256 digest is verified before proposal creation.
3. **Privacy-First Telemetry**: Telemetry contains zero sensitive information (no code, no credentials, no file paths, no IP addresses). Can be disabled via `DOKION_TELEMETRY_DISABLED=1`.

---

## 6. Verification & Test Plan

1. **Unit Tests**:
   - `tests/registry/hub.test.ts`: Search, index filtering, package resolution, forking, merging.
   - `tests/registry/leaderboard.test.ts`: Score calculation, category sorting, verified publisher boost.
   - `tests/telemetry/telemetry.test.ts`: Opt-in check, event spooling, anonymization, batch flushing.
2. **Integration Tests**:
   - `tests/cli/hub-cli.test.ts`: End-to-end testing of `dokion playbooks search|pull|publish|leaderboard|rate`.
