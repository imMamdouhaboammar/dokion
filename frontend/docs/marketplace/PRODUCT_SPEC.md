# Dokion Playbooks Marketplace Product Specification

## Executive Summary
Dokion Playbooks Marketplace is the official ecosystem, distribution, and verified execution layer for Dokion Playbooks. It provides a secure, versioned package registry where developers and security teams can discover, search, preview, install, purchase, publish, rate, and manage Dokion Playbooks with cryptographic provenance and verified execution proof.

## Core Value Proposition
- **Evidence-Based Trust**: No fake badges, fake stars, or simulated scans. Verified badges require real execution sandbox test pass records.
- **Versioned & Immutable**: Playbook packages are content-addressed (`sha256:`) and pinned with auditable lockfiles (`dokion-lock.json`).
- **Safety First**: Packages are treated as executable code with granular permission declarations (filesystem, network, shell, secrets).

## Roles & Permissions Matrix
| Role | Capabilities |
| :--- | :--- |
| **GUEST** | Browse, search, filter, view public listings, read documentation, share links |
| **MEMBER** | Save playbooks, install free playbooks, purchase paid playbooks, review purchases, manage licenses & library |
| **CREATOR** | Onboard publisher profile, upload package releases, set pricing/licensing, view sales & analytics, manage bundles |
| **MODERATOR** | Inspect submission pipeline reports, review security flags, approve/reject/suspend releases, maintain audit trail |
| **ADMIN** | Manage platform configuration, platform fees, refunds, user roles, system health, immutable audit logs |

## Core User Journeys
1. **Discover & Install Free Playbook**: Search/filter -> Inspect manifest & permission declarations -> Add to library -> Execute `dokion playbook install <slug>` -> Lockfile recorded.
2. **Purchase Paid Playbook**: Inspect price & terms -> Server-verified checkout -> Entitlement & license key creation -> Signed download token issued.
3. **Publish & Validate**: Upload bundle -> Automated static analysis, malware check, dependency scan & isolated test execution -> Moderator review -> Published.
4. **Verified Review & Rating**: Verified buyers/installers only -> Submit rating & review -> Creator response -> Public distribution calculation.

## Analytics & Privacy
- Privacy-aware analytics tracking search, views, installs, sales, and submissions without sending private code, secrets, or payment credentials.
