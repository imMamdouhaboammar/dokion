# Dokion Community Playbook Hub — Anti-Slop & Impeccable Design Specification

**Date**: 2026-08-01  
**Author**: Antigravity AI & Design Team  
**Status**: Approved Specification  
**Target Files**: `dokion/docs/index.html`, `dokion/docs/styles.css`, `dokion/docs/app.js`

---

## 1. Product Lens & Design Contract

- **User + Job**: AI Agent developers, software engineers, and DevOps leads discovering, inspecting, pulling, forking, and publishing SHA-256 verified software-hardening playbooks for Dokion AI coding agents.
- **First-Read Object**: Playbook Package ID (`publisher/name`), SHA-256 Digest Badge, Verified Publisher Badge, and Execution Success Rate %.
- **Primary Action**: Copy CLI Pull Command (`dokion hub pull <id>`) or Inspect Detailed Stage Pipeline & JSON Spec.
- **Aesthetic Direction**: High-craft Developer Tool UI (Dark midnight background `#080c14`, subtle ambient mesh gradients, neon cyan `#00f2fe`, vibrant emerald `#10b981`, glassmorphism, crisp borders, `Plus Jakarta Sans` UI typography, `JetBrains Mono` code typography).
- **Forbidden Defaults**: Generic white cards with default shadows, interchangeable SaaS hero banners without domain purpose, ungrounded decorative gradients, generic empty states, and unstyled modals.

---

## 2. Interface Architecture & Component Design

### A. Navigation & Brand Header (`header.navbar`)
- **Brand Identity**: Glowing "D" emblem in cyan-blue gradient with subtle pulse aura, "Dokion Hub" title, and a glowing `GitHub Native` pill.
- **Quick Action Row**:
  - `✨ Publish Playbook` (Secondary glass button with modal trigger).
  - `⚡ Interactive CLI` (Command builder trigger).
  - `GitHub` repository link with SVG icon.

### B. Hero & Terminal Section (`section.hero`)
- **Hero Badge**: `⚡ v1.0 Decentralized Playbook Marketplace & Registry` with glowing live indicator dot.
- **Hero Typography**: High-impact gradient title ("Community Playbook Hub") with focused tagline highlighting SHA-256 cryptographic locking and telemetry backing.
- **Interactive Terminal Widget**:
  - Dark terminal window with prompt `$`, active command display, and copy button.
  - Quick command preset tabs (`ui-review-loop`, `web-fullstack`, `api-service`).
- **Live Stats Bar**:
  - Grid showing Verified Playbooks, Total Downloads, and Avg Success Rate with JetBrains Mono numbers and subtle separators.

### C. Editor's Choice Spotlight (`section.spotlight-section`)
- **Spotlight Card**: Glassmorphic card featuring the #1 ranked playbook (`amElnagdy/ui-review-loop`).
- **Metadata Chips**: Star rating, download count, success rate bar, and stage preview tags.
- **Quick Actions**: `⚡ Quick Pull` and `🔍 Inspect Details` buttons.

### D. Main Marketplace & Controls (`main.container`)
- **Control Bar**:
  - Search input with `/` shortcut badge and instant query filtering.
  - Dynamic Category Pills with item counts: `All Domains (6)`, `UI / UX (2)`, `Security (1)`, `Backend (1)`, `AI Slop Cleanup (1)`, `Testing (1)`, `DevOps (1)`.
  - Sort select dropdown (`Quality Score`, `Total Downloads`, `Star Rating`, `Execution Success %`).
  - View Toggle (`Grid` vs. `Leaderboard Table`).
- **Card Grid View (`.playbook-grid`)**:
  - Elevated glassmorphic cards with hover lift (`translateY(-4px)`), cyan border highlight, publisher avatar & handle, verified badge, description clamp, stage tags, success rate progress bar, SHA-256 digest tag, and action buttons (`Copy Cmd`, `Inspect`).
- **Leaderboard Table View (`.leaderboard-table`)**:
  - High-density table view with Gold (#1), Silver (#2), Bronze (#3) badges, composite quality score, stars, downloads, success rate %, and action buttons.

### E. Rich Inspection Modal & Tabs (`#inspect-modal`)
- **Modal Header**: Playbook title, publisher avatar & trust score, verified pill, and close button.
- **Tab Navigation**:
  1. `Overview & Pipeline`: Stage breakdown with step counts, pipeline diagram, and execution requirements.
  2. `JSON Spec`: Formatted JSON view of the playbook configuration.
  3. `CLI Command Builder`: Interactive flag toggles (`--force`, `--digest`, `--dry-run`) generating live command string with copy button.

### F. Publish Playbook Modal (`#publish-modal`)
- **Option 1**: Dokion CLI command runner instructions.
- **Option 2**: Interactive Web Form for drafting and previewing a playbook JSON before opening a GitHub Pull Request.

### G. Toast Notification System (`#toast-container`)
- Floating bottom-right toasts with spring slide animation and checkmark icon.

---

## 3. Technical Implementation Plan

1. **`dokion/docs/index.html`**:
   - Update HTML structure to include new fonts (`Plus Jakarta Sans`), hero terminal tabs, category pills with count spans, modal tab container, publish form structure, and accessibility attributes.
2. **`dokion/docs/styles.css`**:
   - Complete CSS overhaul implementing modern glassmorphism, responsive grid, high-contrast dark theme tokens, CSS custom properties, micro-animations, glowing progress bars, and modal tab styling.
3. **`dokion/docs/app.js`**:
   - Upgrade client logic to calculate category counts dynamically, support modal tabs (Overview, JSON, CLI Builder), interactive flag toggles, search shortcut `/`, keyboard navigation, and publish form preview.

---

## 4. Verification Plan

- **Visual & Layout Check**: Ensure no layout shifts, responsive breakpoints at 375px, 768px, 1280px, and 1920px.
- **Interactive Check**: Search input filter, category pill filtering, sort ordering, modal tabs switching, copy command toasts, publish form submission preview.
- **Browser Execution**: Open `dokion/docs/index.html` in browser or verify via local HTTP server / static check.
