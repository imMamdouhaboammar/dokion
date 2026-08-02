# AI Skills Creator
## Design.md

Version: 1.0  
Date: 2026-03-21

## 1) Product summary

AI Skills Creator is an English-first workspace for building, scanning, testing, validating, importing, exporting, and managing AI skills for Claude, ChatGPT, and adjacent agent ecosystems.

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

Anthropic documents skills as folders containing instructions, scripts, and resources that are loaded dynamically for specialized tasks.[^anthropic-skills-repo] Claude Code also documents that a skill can be created with a `SKILL.md` file, that skills are auto-discovered, and that they load when relevant rather than always staying in context.[^claude-code-skills][^claude-memory-rules] Anthropic also describes Agent Skills as using progressive disclosure to manage context efficiently.[^claude-platform-overview]

Dexie positions itself as an IndexedDB wrapper for offline-first apps and documents it as a minimal, high-performance layer over the browser’s standard local database.[^dexie-home][^dexie-docs]

These facts directly support the product direction:

- package-based skill structure
- local-first project storage
- dynamic skill activation
- context-aware testing
- modular artifacts instead of one giant instruction blob

## 4) Product design thesis

Design a calm AI builder workspace for serious users.

Notion is for notes. Claude is for thinking. GitHub is for source. AI Skills Creator sits between them as the place where messy intent becomes a clean, testable, portable skill.

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

This matches Anthropic’s own description of skills using progressive disclosure for context management.[^claude-platform-overview]

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

Because Dexie is designed as a wrapper over IndexedDB for offline-first apps, it fits this product well.[^dexie-home][^dexie-docs]

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

The strongest version of AI Skills Creator is:

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

[^anthropic-skills-repo]: Anthropic GitHub, “Skills”, official repository overview. https://github.com/anthropics/skills
[^claude-code-skills]: Claude Code Docs, “Extend Claude with skills”. https://code.claude.com/docs/en/slash-commands
[^claude-memory-rules]: Claude Code Docs, “How Claude remembers your project”. https://code.claude.com/docs/en/memory
[^claude-platform-overview]: Claude API Docs, “Features overview”, Agent Skills section. https://platform.claude.com/docs/en/build-with-claude/overview
[^dexie-home]: Dexie official site, product overview. https://dexie.org/
[^dexie-docs]: Dexie Docs, overview. https://dexie.org/docs
