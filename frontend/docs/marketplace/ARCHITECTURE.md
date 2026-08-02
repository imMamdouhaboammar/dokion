# Dokion Playbooks Marketplace Architecture

## System Architecture

The Dokion Playbooks Marketplace is architected as a hybrid web application, API platform, and CLI registry server.

```
+-----------------------------------------------------------------------+
|                            Dokion Web App                             |
|  (Store, Explore, Publisher Portal, Moderation Studio, Admin Console) |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                         Domain Service Layer                          |
|  - Auth & RBAC Engine (Guest, Member, Creator, Moderator, Admin)      |
|  - Registry Service (Search, Categories, Playbook Resolution)         |
|  - Package Validation & Sandbox Engine (Static Analysis, Isolation)   |
|  - Commerce & Entitlement Service (Checkout, Licenses, Revenue)       |
|  - CLI Marketplace API (/api/cli/v1/*)                                |
+-----------------------------------+-----------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  Database Layer       |                       |  Content & Storage    |
|  - PostgreSQL Schema  |                       |  - Content-addressed  |
|    / Dexie IDB Sync   |                       |    SHA-256 Storage    |
|  - Audit Log Ledger   |                       |  - Signed Package URLs|
+-----------------------+                       +-----------------------+
```

## Key Architectural Components

### 1. Data Layer & Schemas
- **User & Publisher Profiles**: Multi-tenant publisher teams with handle uniqueness.
- **Playbook & Version Records**: Immutable semver records (`1.0.0`), SHA-256 digests, signature verifications.
- **Entitlements & Licenses**: Order items, minor-unit currency amounts (`priceUsdCents`), license seat tracking, signed download tokens.
- **Audit Logs**: Immutable log entries for moderation, publishing, suspensions, and refunds.

### 2. Validation & Security Pipeline
- Manifest schema validation against `PLAYBOOK_SPEC.md`.
- Zip bomb & archive traversal checks (`..`, symlink restrictions, size limits).
- Static code analysis, dependency vulnerability scanning, and secret leak detection.
- Isolated test runner verifying outputs against the `dokion-findings` protocol.

### 3. CLI & Registry Protocol
- REST API `/api/cli/v1` supporting `search`, `info`, `install`, `update`, `verify`, and `auth`.
- Local installation state tracked via `dokion-lock.json` with content-addressed cache blobs.
