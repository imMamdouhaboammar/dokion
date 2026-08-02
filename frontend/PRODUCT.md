# PRODUCT.md

## Product Summary
Dokion Playbooks Store is the official marketplace, registry discovery portal, and verified execution studio for Dokion AI Playbooks. It enables users to install, buy, sell, share, and run verified Dokion Playbooks with rigorous cryptographic provenance checks, content-addressed caching, pinned inert installation, auditable lockfiles (`dokion-lock.json`), and explicit capability activation rules.

## Non-Goals
- Real-time video conferencing or voice calls.
- Native desktop binary compilation outside web browser & Cloud Run sandbox environment.
- Unencrypted plain-text key storage.

## Target Users & Roles
- **Dokion Playbook Buyer / User**: Discovers, inspects, purchases, caches, activates, and executes verified agent playbooks.
- **Playbook Creator / Publisher**: Authors, prices, packages, and sells custom Dokion playbooks (`.dokion` bundles) to the Dokion Store marketplace.
- **Security & Integrity Auditor**: Inspects exact semver versions, file manifests, capability permissions, content-addressed SHA-256 hashes, GPG/Ed25519 signatures, and auditable lockfiles.

## Core Capabilities & Features
- **Playbook Store Marketplace**: Browse, filter, buy ($USD or Dokion Tokens), sell, and share Dokion playbooks with category filters, registry source selection, and search.
- **Independent Registry Discovery**: Configurable independent registry sources (`registry.dokion.io`, `github.com/imMamdouhaboammar/dokion`, community registries) with live metadata validation.
- **Deep Metadata & Provenance Inspection**: Pre-retrieval modal inspecting exact versions, file trees (`playbook.yaml`), required capabilities, granular permission scopes, engine compatibility, and cryptographically verified provenance signatures.
- **Content-Addressed Cache (`sha256:`)**: Integrity verification before pulling immutable package bytes into content-addressed cache blobs.
- **Pinned Inert Package Installation**: Installs inert packages without execution privilege and writes an auditable `dokion-lock.json` lockfile.
- **Explicit User Activation Policy**: Activation occurs only upon explicit user consent after reviewing requested capabilities and Dokion policy checks.
- **Dokion Playbook Execution Runner**: Interactive sandboxed playground to run activated playbooks with live step traces, parameter inputs, permission approval prompts, and Gemini AI backend.
- **Publisher Portal**: Tools for creators to publish, set pricing (Free / Paid), manage licenses, and track sales revenue.

## Data Boundaries & State Behavior
- **Local Storage (Dexie / IndexedDB)**: Stores installed playbooks, registry configurations, content-addressed cache blobs, lockfile entries, publisher listings, and purchase transactions.
- **Auditable Lockfile**: `dokion-lock.json` generated for installed packages with SHA-256 integrity digests, dependency tree, and activation audit trail.
- **Server API Proxy**: Secure server-side routes for Gemini AI models and registry sync.

## Core User Flows
1. **Create Skill**: User selects "Create Skill" -> chooses Blank, Template, or GitHub Import -> defines name, triggers, and instructions -> saves to local Library.
2. **Edit Skill**: User opens Editor -> modifies system prompt, description, or examples -> live validation feedback updates in real time.
3. **Test & Compare**: User enters Chat View -> selects active skill -> sends test prompt -> compares Base Model vs Skill-Enhanced responses side-by-side.
4. **Validate**: User opens Validation View -> runs test suite -> views passing score, warnings, and unslop preflight metrics.

## Feature List
- Visual Skill Editor (SKILL.md editor, prompt metadata, example pairs)
- Interactive Dual-Pane Chat Playground
- Automated Skill Quality & Compliance Validator
- GitHub Skill Importer & skills.sh Community Registry Explorer
- Local Project Library with Search and Tagging
- MCP (Model Context Protocol) Server Integration Modal & Settings

## Functional Requirements
- The system must persist user-created skills and projects across browser reloads using IndexedDB.
- The system must validate SKILL.md formatting, trigger presence, and system prompt constraints.
- The system must support side-by-side chat view with toggleable comparison mode.
- The system must provide fallback mock responses when GEMINI_API_KEY is not configured.

## Acceptance Criteria (Examples)
- **Given** I create a new skill with valid metadata, **when** I save, **then** it appears in my local Library and can be selected in the Chat playground.
- **Given** I am in the Chat view, **when** I toggle "Compare Mode", **then** two response columns (Base Model vs Skill Model) are rendered.

## Constraints
- Must run in web browsers supporting ES2022 and IndexedDB.
- Must maintain dark/light theme compatibility according to system preferences or user toggle.

## Risk Notes
- GEMINI_API_KEY missing: Solved by graceful fallback mock responses and key input prompts.
- IndexedDB storage limits: Solved by keeping prompt text light and omitting large binary blobs.

## AI-Agent Implementation Boundaries
- Inspect existing files before editing.
- Change one feature area at a time.
- Preserve existing behavior unless explicitly instructed.
- Ensure all interactive controls have semantic HTML elements and proper keyboard focus states.

