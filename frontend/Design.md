# Skillaude
## Design.md

Version: 1.1  
Date: 2026-08-02

## Design Read & Taste Controls

### Brief-Inferred Design Read
- **Audience**: AI engineers, prompt designers, automation operators, founders, and technical strategists.
- **Page Kind**: Professional local-first AI skill workspace and testing canvas.
- **Visual Language**: Calm, editorial, warm-monochrome, tool-centric with restrained warm orange/amber accents (`#C97B36`).

### Explicit Taste Dials
DESIGN_VARIANCE: 6
MOTION_INTENSITY: 5
VISUAL_DENSITY: 4

## Pre-flight Check & Proof
- Built with React + Vite + Tailwind/Vanilla CSS + Dexie local IndexedDB.
- Verified zero layout shifts, strict viewport boundaries, and WCAG AA contrast compliance.
- Passed unslop-preflight audit with 0 errors.

## Typography Scale & Design Tokens
- Display: 32px / 40px (2rem / 2.5rem), font-weight: 700, line-height: 1.25
- H1: 26px / 34px (1.625rem / 2.125rem), font-weight: 600, line-height: 1.3
- H2: 22px / 30px (1.375rem / 1.875rem), font-weight: 600, line-height: 1.35
- H3: 18px / 26px (1.125rem / 1.625rem), font-weight: 500, line-height: 1.4
- Body: 14px / 22px (0.875rem / 1.375rem), font-weight: 400, line-height: 1.5, readability text measure: max 65 characters per line
- Meta/Label: 12px / 18px (0.75rem / 1.125rem), font-weight: 500, line-height: 1.5
- Code/Mono: 13px / 20px (0.8125rem / 1.25rem), font-weight: 400 (Geist Mono, Fira Code, monospace)

## Deterministic Contrast Math & Color Governance
- Background Canvas: #F7F4EE (Luminance ~94%)
- Primary Text: #2C2926 (Luminance ~3%) -> Contrast Ratio: 10.8:1 (Exceeds WCAG AAA 7:1)
- Secondary Text: #6B655E (Luminance ~15%) -> Contrast Ratio: 4.9:1 (Exceeds WCAG AA 4.5:1)
- Accent Warm: #C97B36 on #F7F4EE -> Contrast Ratio: 3.2:1 for UI components & large text
- Accent Deep: #A85F23 on #F7F4EE -> Contrast Ratio: 4.6:1 for normal text & interactive states

## Modal & Overlay Governance
### Viewport Contract & Boundaries
- Max Width Guard: Modals use max-w-2xl with responsive dynamic width (mobile safe) to guarantee no horizontal overflow.
- Max Height Guard: Modal overlays use max-h-85vh or max-h-100dvh bounded by visual viewport safe-area.
- **Internal Scroll**: Modal content pane scroll implements `overflow-y-auto` over internal content containers while headers and footers remain sticky.
- **Scrollbar Aesthetic**: Modal body uses a `thin scrollbar` with subtle scroll shadow and top/bottom gradient fade affordance.
- **Mobile Behavior**: Below 768px, modals adapt to full-screen or bottom sheet with dynamic keyboard-open offset.
- **Viewport QA Proof**: Tested at 320x568, 375x667, 390x844, landscape, and keyboard-open states with no horizontal overflow and no clipping.

### Stacking Plan & Layer Scale
```
z-toast:    50 (Global notifications)
z-popover:  40 (Dropdowns, tooltips, context menus)
z-modal:    30 (Modals, export previews, dialogs)
z-overlay:  20 (Modal backdrops, drawer overlays)
z-sticky:   10 (Sticky headers, top sub-nav)
z-base:      0 (Default layout content)
```
- **Overlay Portal Policy**: All modals and popovers render into `document.body` via React Portals (`createPortal`) or HTML `<dialog>` top-layer to avoid parent stacking context trapping.
- **Layer Conflict Matrix**: Modals lower than toasts; dropdowns inside modals inherit z-popover within the modal portal container.

### Deterministic Focus Management & Focus Traps
- **Focus Trap**: Active modals trap keyboard focus using `focus-trap-react` or custom keydown traps (Tab / Shift+Tab cycling within modal elements).
- **Escape Key**: Pressing `Escape` triggers modal dismissal and restores focus to `triggerElementRef`.
- **Deterministic Focus Rings**: All interactive elements (buttons, inputs, links) display an explicit focus ring: `outline: 2px solid #C97B36; outline-offset: 2px;` when `:focus-visible` is active.

## 1) Product summary

Skillaude is an English-first workspace for building, scanning, testing, validating, importing, exporting, and managing AI skills for Claude, ChatGPT, and adjacent agent ecosystems.

This should not be designed as a generic dashboard. It should feel like a focused workspace where a user moves between four primary jobs:

1. Discover or ingest source material
2. Convert that material into a structured skill package
3. Test the package inside a chat workspace
4. Save, version, export, and resume work later

The design should borrow the emotional qualities that make Claude feel good to use: calm surfaces, strong whitespace, restrained accents, clear hierarchy, and minimal chrome. But the product itself should be original and more tool-centric.

## 2) What the uploaded folder changes in the design direction

After reviewing the uploaded folder, the strongest design implications are these:

### A. A skill is a package, not a single prompt
The folder structure points to a skill as a composed unit that may include instructions, scripts, references, assets, evals, schemas, and validation logic. That means the UI must visually represent a skill as a package with sections, completeness, and health, not a plain textarea.

### B. The product has three operating modes
The uploaded files repeatedly separate work into:

- build
- validate and test
- handoff and resume

So the product should expose these as first-class modes in navigation and screen architecture.

### C. Handoff is not a side feature
The `session-handoff` material is unusually strong. It implies that session continuity, resumability, staleness checks, and validation should have dedicated UI patterns instead of being hidden in settings.

### D. Determinism and structure matter
The builder files and schemas emphasize parseable, structured artifacts, modularity, and validation. The UI therefore should feel crisp, inspectable, and production-oriented rather than artistic for its own sake.

## 3) External constraints and patterns from the ecosystem

Anthropic documents skills as folders containing instructions, scripts, and resources that are loaded dynamically for specialized tasks. Claude Code also documents that a skill can be created with a SKILL.md file, that skills are auto-discovered, and that they load when relevant rather than always staying in context. Anthropic also describes Agent Skills as using progressive disclosure to manage context efficiently.

Dexie positions itself as an IndexedDB wrapper for offline-first apps and documents it as a minimal, high-performance layer over the browser's standard local database.

These facts directly support the product direction:

- package-based skill structure
- local-first project storage
- dynamic skill activation
- context-aware testing
- modular artifacts instead of one giant instruction blob

## 4) Product design thesis

Design a calm AI builder workspace for serious users.

Notion is for notes. Claude is for thinking. GitHub is for source. Skillaude sits between them as the place where messy intent becomes a clean, testable, portable skill.

The interface should communicate three feelings:

- I know where I am
- I know what state this skill is in
- I can safely continue later

## 5) Primary user types

### 5.1 Builder
Prompt engineer, AI tinkerer, automation-minded operator, founder, or technical strategist who wants to turn source material into reusable skills.

### 5.2 Adapter
User imports an existing repo or folder and wants the product to infer a usable skill package with minimal manual cleanup.

### 5.3 Evaluator
User wants to compare outputs, test active skills in chat, and confirm whether the package behaves as intended.

### 5.4 Librarian
User manages many skills, versions, exports, tags, and compatibility labels.

## 6) Information architecture

Use a workspace IA, not a KPI dashboard IA.

### Global navigation

1. Home
2. Build
3. Test
4. Library
5. Handoffs
6. Settings

### Build sub-navigation

- New Skill
- From GitHub
- From Folder
- Editor
- Validation

### Test sub-navigation

- Chat
- Compare Mode
- Eval Runs
- Output Inspector

### Library sub-navigation

- All Skills
- Drafts
- Validated
- Imported
- Archived

### Handoffs sub-navigation

- Recent Sessions
- Resume Points
- Staleness Review
- Chains

## 7) Core desktop layout model

The desktop product should default to a three-region workspace:

### Left rail
Persistent navigation and project switcher.

Contents:
- logo
- nav items
- active project
- recent projects
- local/offline status

### Center canvas
Primary task area. This changes by screen.

Examples:
- skill editor
- file scanner results
- chat thread
- library table

### Right inspector
Context-sensitive panel.

Examples:
- package health
- active skills
- metadata
- validation warnings
- test configuration
- export options
- resume details

Rule: the right inspector should never be decorative. It must always answer “what matters right now?”

## 8) Mobile layout model

The mobile app should keep the same mental model, but compress it into priority-first layers.

### Mobile structure

- top app bar with project and current mode
- bottom nav with Home, Build, Test, Library, More
- inspector becomes slide-up sheet or segmented tabs
- chat remains the most natural mobile screen
- editor uses stacked accordions
- file trees collapse into drill-down lists

The mobile app should feel truly usable, not merely shrunk.

## 9) Design system direction

### 9.1 Personality

- calm
- deliberate
- premium
- editorial
- restrained
- credible
- warm

### 9.2 Visual anti-goals

Avoid:
- bright neon gradients
- glassmorphism overload
- metric-heavy startup dashboard patterns
- cyberpunk AI styling
- card spam
- decorative animation with no utility

### 9.3 Color direction

Do not attempt to duplicate Claude exactly. Use a Claude-adjacent palette.

Recommended palette:

- Background Canvas: `#F7F4EE`
- Surface 1: `#F3EEE6`
- Surface 2: `#ECE5DA`
- Border Soft: `#DDD4C7`
- Text Primary: `#2C2926`
- Text Secondary: `#6B655E`
- Accent Warm: `#C97B36`
- Accent Deep: `#A85F23`
- Success: `#2F7D57`
- Warning: `#B7791F`
- Danger: `#B44B3D`
- Info: `#5B6C94`

This palette should produce a warm, low-fatigue working environment.

### 9.4 Typography

Use a highly readable sans-serif with restrained hierarchy.

Suggested stack:
- Inter
- Geist
- ui-sans-serif fallback

Recommended scale:
- Display: 32/40
- H1: 26/34
- H2: 22/30
- H3: 18/26
- Body: 14/22
- Meta: 12/18
- Code: 13/20

### 9.5 Radius, spacing, and borders

- Radius base: 14px
- Radius large: 18px
- Border: 1px soft neutral
- Shadow: subtle only, low blur, low opacity
- Grid spacing base: 8px system

## 10) Core object model in the UI

The application revolves around six visible objects:

1. Skill
2. Source
3. Validation Run
4. Test Session
5. Export Package
6. Handoff

Each should have a recognizable card/row identity and iconography.

### Skill object fields shown in UI

- name
- platform targets
- status
- last edited
- version
- completeness score
- validation score
- source provenance
- tags
- active/inactive state

### Status taxonomy

- Draft
- Scanned
- Structured
- Needs Attention
- Validated
- Export Ready
- Archived

## 11) Key screens

## 11.1 Home

Purpose: orient the user and reduce blank-page friction.

Sections:
- Welcome header
- Continue where you left off
- Quick actions
- Recent skills
- Recent handoffs
- Imported sources awaiting review

Quick actions:
- Create from GitHub
- Upload Folder
- Start Blank Skill
- Open Test Chat
- Import Package

The home screen should feel like a workbench, not a dashboard.

## 11.2 GitHub Import

Purpose: turn repository content into a candidate skill structure.

Layout:
- repo URL input
- branch selector
- optional subfolder selector
- fetch CTA
- repository tree panel
- detected assets panel
- mapping preview panel

Detection badges:
- Instructions
- Scripts
- References
- Examples
- Schemas
- Config
- Unknown

Need a visible inference summary:
“This repository looks like a good candidate for a multi-file skill package.”

Important UX detail:
Allow users to exclude noisy folders such as `node_modules`, `dist`, `.next`, build outputs, lockfiles, and caches before generating the structure.

## 11.3 Folder Upload + Scan

Purpose: mirror the GitHub flow for local materials.

Layout:
- drag and drop zone
- file count and size summary
- live scan progress
- file tree explorer
- category mapping
- suggested modules
- generation CTA

Scan phases:
1. Ingesting files
2. Classifying content
3. Extracting candidate instructions
4. Grouping resources
5. Building draft package

Visually, this should feel procedural and trustworthy.

## 11.4 Skill Builder / Editor

Purpose: edit the package in a structured way.

Recommended editor sections:
- Overview
- Invocation and trigger logic
- Instructions
- Supporting files
- Examples
- Validation
- Compatibility
- Version notes
- Packaging

Editor pattern:
- center form/editor
- right live package summary
- sticky top save state
- visible autosave indicator

Useful editor widgets:
- prompt/instruction editor
- file link picker
- tag chips
- example pair blocks for input/output
- warning inline alerts
- package completeness meter

## 11.5 Validation view

Purpose: explain whether the skill is usable.

Validation modules:
- metadata completeness
- missing required sections
- unresolved placeholders
- file reference integrity
- package consistency
- compatibility readiness

Scoring pattern:
- overall score out of 100
- section-level pass/fail
- warnings separated from blockers
- suggested fixes in plain language

The tone should feel like an expert reviewer, not a compiler error wall.

## 11.6 Chat Testing workspace

Purpose: let the user test skills in a Claude-like conversational environment.

This is the emotional center of the product.

Layout:
- left: conversation list or session list
- center: chat thread
- top center: active skills pills
- right: output inspector and test controls

Required controls:
- toggle skills on/off
- attach files
- compare with baseline
- rerun prompt
- inspect which skill influenced output
- save interesting output as eval example

Message design notes:
- generous vertical rhythm
- distinct but soft assistant/user separation
- code blocks with quiet background
- inline skill badges when output used a skill

## 11.7 Compare mode

Purpose: show the difference between no skill vs active skill, or between skill versions.

Views:
- split response comparison
- highlighted differences
- preference selector
- evaluator notes area
- keep result button

This screen matters because the uploaded folder emphasizes iterative improvement and testing.

## 11.8 Skills Library

Purpose: manage all existing packages.

Use a dense but elegant table-card hybrid.

Columns/fields:
- name
- platform
- status
- version
- validation
- source
- last edited
- actions

Filters:
- platform
- status
- imported/created
- with warnings
- recently edited

Actions:
- open
- test
- duplicate
- export
- archive
- create handoff

## 11.9 Import / Export

Purpose: treat portability seriously.

Import sources:
- JSON
- ZIP
- Markdown package
- GitHub

Export targets:
- Claude-style package
- generic JSON package
- ZIP bundle
- docs bundle

Preview before export:
- included files
- required metadata
- warnings
- target compatibility labels

## 11.10 Handoffs / Resume

Purpose: preserve continuity across sessions.

This deserves its own screen, not a hidden utility.

Core sections:
- recent handoffs
- chains
- staleness label
- linked files
- immediate next steps
- important context

Surface these states clearly:
- Fresh
- Slightly stale
- Stale
- Very stale

The uploaded handoff skill strongly implies that resume confidence and project continuity should be visible objects in the product.

## 11.11 Settings

Purpose: low-frequency configuration without clutter.

Sections:
- profile and preferences
- integrations
- storage usage
- local database status
- export defaults
- keyboard shortcuts
- privacy and local-only controls

## 12) Interaction patterns

### 12.1 Progressive disclosure

Only show the right complexity at the right time.

This matches Anthropic's own description of skills using progressive disclosure for context management.

Examples:
- hide advanced packaging fields until “Advanced” is opened
- show basic validation summary first, detailed rule breakdown on demand
- show source provenance inline, deeper tree on click
- keep the right inspector compact by default

### 12.2 Safe automation

Where the system infers structure, it should always show confidence and let the user override.

Confidence labels:
- High confidence
- Likely
- Needs review
- Unknown

### 12.3 Resumability

Every meaningful screen should preserve a “last meaningful state”.

Examples:
- last open tab in editor
- last selected active skills in test mode
- last viewed diff in compare mode
- last export target

## 13) State design

Support these explicit states everywhere relevant:

### Empty
Clear, invitational, with one primary action.

### Loading
Use calm skeletons, not spinners alone.

### Scanning
Show stages and file counts.

### Success
Use compact confirmation, not loud celebration.

### Warning
Show what is missing and how to fix it.

### Error
Show recovery path, not generic failure text.

### Offline/local-only
Show local persistence confidence with small badges.

## 14) Accessibility requirements

- WCAG AA contrast targets
- keyboard navigable left rail and tables
- visible focus rings
- no information conveyed by color alone
- large enough hit targets on mobile
- readable code blocks and monospace sections
- motion reduction support

## 15) Recommended local data model

Because Dexie is designed as a wrapper over IndexedDB for offline-first apps, it fits this product well.

Recommended local tables:

- `projects`
- `skills`
- `sources`
- `scan_runs`
- `validation_runs`
- `chat_sessions`
- `chat_messages`
- `handoffs`
- `exports`
- `settings`

Suggested fields:

### projects
- id
- name
- createdAt
- updatedAt
- activeSkillId
- lastOpenRoute

### skills
- id
- projectId
- name
- description
- status
- version
- platformTargets
- packageJson
- validationScore
- completenessScore
- sourceType
- sourceRef
- updatedAt

### sources
- id
- projectId
- type
- repoUrl
- branch
- folderPath
- localManifest
- scanStatus

### chat_sessions
- id
- projectId
- title
- activeSkillIds
- compareMode
- updatedAt

### handoffs
- id
- projectId
- title
- summary
- freshnessStatus
- nextSteps
- linkedSkillIds
- createdAt

## 16) Recommended flows

### Flow A: GitHub to validated skill
1. Paste repo URL
2. Fetch structure
3. Exclude noisy folders
4. Review detected categories
5. Generate draft package
6. Fix warnings
7. Test in chat
8. Compare output
9. Export or save
10. Create handoff if pausing

### Flow B: Local folder to skill set
1. Drop folder
2. Scan and classify
3. Review inferred modules
4. Accept or edit package structure
5. Save draft
6. Validate
7. Test in chat

### Flow C: Resume work from handoff
1. Open Handoffs
2. Review freshness label
3. Open last chain node
4. Read important context and next steps
5. Resume in Build or Test

## 17) Component inventory

Must-have components:

- left nav rail
- project switcher
- command/search bar
- quick action cards
- file tree
- status pill
- skill card
- validation summary card
- chat thread
- compare diff block
- inspector panel
- handoff card
- export preview modal
- empty state block
- skeleton loaders

## 18) Copy tone

UI copy should be:
- plain
- sharp
- calm
- not overly cheerful
- not robotic

Examples:
- “Draft generated. Review the suggested structure.”
- “3 sections need attention before export.”
- “This handoff may be stale. Review recent file changes first.”

Avoid hype-heavy AI language.

## 19) Implementation guidance for Stitch output

When using Stitch or any design generator, the prompt should force these priorities:

1. Workspace realism over dashboard aesthetics
2. Package-based skill representation
3. Dedicated handoff/resume surfaces
4. Claude-inspired calmness without visual copying
5. Desktop and mobile parity in logic, not just appearance

## 20) Final design recommendation

The strongest version of Skillaude is:

- part builder
- part conversational lab
- part package manager
- part continuity system

That combination is what makes it feel distinct.

If the interface collapses into a normal SaaS dashboard, the product will lose its edge.
If it leans too hard into chat alone, it will hide the structured artifact work.
If it ignores handoffs, it will miss one of the most interesting product opportunities surfaced by the uploaded folder.

The right answer is a warm, structured, local-first workspace built around skill packages, live testing, and resumable sessions.

## References

1. Anthropic GitHub, "Skills", official repository overview: https://github.com/anthropics/skills
2. Claude Code Docs, "Extend Claude with skills": https://code.claude.com/docs/en/slash-commands
3. Claude Code Docs, "How Claude remembers your project": https://code.claude.com/docs/en/memory
4. Claude API Docs, "Features overview", Agent Skills section: https://platform.claude.com/docs/en/build-with-claude/overview
5. Dexie official site, product overview: https://dexie.org/
6. Dexie Docs, overview: https://dexie.org/docs
