# Documentation Demo and Adoption Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task

**Goal:** Publish documentation and proof assets that let a new user complete the supported Secure Release journey and validate Dokion on ten external repositories without unsupported product claims

**Architecture:** Build an Astro Starlight documentation application that consumes generated product-surface and Run Trace data. Use a maintained demo repository and reproducible acceptance transcripts as proof. Run a consent-based external cohort without adding mandatory telemetry or a hosted authority service

**Tech Stack:** Astro Starlight, Astro, Bun 1.3.14, TypeScript, GitHub Pages, Playwright, axe, generated JSON snapshots

## Global Constraints

- Documentation follows implementation and cannot be the source of runtime authority
- GitHub Pages uses the repository base path `/dokion/`
- Custom routes reuse `StarlightPage` and preserve Starlight layout and accessibility contracts
- The site reads validated generated snapshots and never interprets arbitrary Registry metadata in the browser
- No remote third-party scripts, analytics, fonts, or embeds are required for the first release
- Demo output is generated from an exact Dokion commit and maintained fixture
- External cohort data is collected only with explicit participant consent
- No ratings, download counts, success rates, or publisher verification badges are published

---

### Task 1: Create the Starlight documentation foundation

**Files:**
- Create: `site/package.json`
- Create: `site/astro.config.mjs`
- Create: `site/tsconfig.json`
- Create: `site/src/content.config.ts`
- Create: `site/src/content/docs/index.mdx`
- Create: `site/src/styles/custom.css`
- Create: `site/src/pages/404.astro`
- Create: `tests/site/site-build.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces static site under `site/dist/`
- Uses Starlight docs collection through `docsLoader` and `docsSchema`

- [ ] **Step 1: Write a failing site build contract**

Require

- Correct `site` URL and `base: "/dokion/"`
- Starlight content collection configuration
- A static production build
- No runtime server dependency
- No remote font requirement
- A 404 page with navigation back to the docs root

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/site/site-build.test.ts`

Expected result: the `site/` application does not exist

- [ ] **Step 3: Add pinned site dependencies**

Pin exact compatible Astro and Starlight versions in `site/package.json`

Use the repository lockfile strategy selected during implementation and record versions in `site/README.md`

- [ ] **Step 4: Configure Starlight**

Use generated navigation groups for

- Getting Started
- Core Concepts
- Packs
- Run Trace
- Playbook Authoring
- CLI Reference
- Agent Integrations
- Registry Status
- Security
- Troubleshooting
- Releases

- [ ] **Step 5: Add restrained design tokens**

Use neutral surfaces, one primary accent, readable code blocks, visible focus, reduced motion, responsive tables, and a maximum reading width

Do not use gradient text, glow effects, glass effects, fake terminals, or dense card walls

- [ ] **Step 6: Run build and focused tests**

Run

```bash
bun --cwd site install --frozen-lockfile
bun --cwd site run build
bun test tests/site/site-build.test.ts
```

Expected result: static build succeeds under `/dokion/`

- [ ] **Step 7: Commit**

```bash
git add site tests/site/site-build.test.ts package.json bun.lock
git commit -m "feat: create Starlight documentation foundation"
```

### Task 2: Generate documentation data from canonical runtime sources

**Files:**
- Create: `scripts/docs/generate-cli-reference.ts`
- Create: `scripts/docs/generate-product-status.ts`
- Create: `scripts/docs/generate-pack-catalog.ts`
- Create: `site/src/data/generated/cli-reference.json`
- Create: `site/src/data/generated/product-surface.json`
- Create: `site/src/data/generated/packs.json`
- Create: `tests/site/generated-docs-data.test.ts`
- Modify: `site/package.json`

**Interfaces:**
- Consumes: CLI command registry, `generated/product-surface.json`, built-in Pack registry
- Produces deterministic site data

- [ ] **Step 1: Write failing drift tests**

Require generated data to match the current command registry, product surface, Pack registry, and exact Dokion version

Reject unknown status values, duplicate commands, unsupported examples, and manual edits to generated files

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/site/generated-docs-data.test.ts`

Expected result: generators and data do not exist

- [ ] **Step 3: Implement generators**

Generate only from imported canonical modules or validated snapshots

Sort commands, integrations, Packs, and Registry states deterministically

- [ ] **Step 4: Add site generation scripts**

Add

```json
"generate": "bun run ../scripts/docs/generate-cli-reference.ts && bun run ../scripts/docs/generate-product-status.ts && bun run ../scripts/docs/generate-pack-catalog.ts",
"build": "bun run generate && astro build"
```

- [ ] **Step 5: Add generated drift gate**

Run generation in CI and reject any working tree diff

- [ ] **Step 6: Verify**

Run

```bash
bun --cwd site run generate
bun test tests/site/generated-docs-data.test.ts
bun --cwd site run build
```

Expected result: docs data cannot drift from runtime behavior

- [ ] **Step 7: Commit**

```bash
git add scripts/docs site/src/data/generated tests/site/generated-docs-data.test.ts site/package.json
git commit -m "feat: generate docs from runtime contracts"
```

### Task 3: Build the first-run and Run Trace pages

**Files:**
- Create: `site/src/content/docs/getting-started/install.mdx`
- Create: `site/src/content/docs/getting-started/secure-release.mdx`
- Create: `site/src/content/docs/concepts/skills-playbooks-runtime.mdx`
- Create: `site/src/content/docs/concepts/run-trace.mdx`
- Create: `site/src/content/docs/playbooks/authoring.mdx`
- Create: `site/src/components/CommandStatus.astro`
- Create: `site/src/components/RunTraceSummary.astro`
- Create: `tests/site/content-contract.test.ts`

**Interfaces:**
- Consumes: generated command and Run Trace examples
- Produces complete supported user journey

- [ ] **Step 1: Write failing content contracts**

Require

- Every shell command parses through the canonical CLI parser
- Secure Release support limits are explicit
- Activation requires exact digest and actor
- Passing and blocked Run Trace examples are generated artifacts
- Skills versus Playbooks wording focuses on state, order, authority, evidence, and verification rather than an absolute task-size distinction
- Registry state is separate from built-in Pack availability

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/site/content-contract.test.ts`

Expected result: pages and components do not exist

- [ ] **Step 3: Write the Getting Started journey**

The page order is

1. Install
2. Preview Secure Release
3. Review authority summary
4. Accept exact digest
5. Inspect Run Trace
6. Re-run the committed Playbook

- [ ] **Step 4: Add generated proof components**

`CommandStatus.astro` displays implementation status and evidence paths from generated data

`RunTraceSummary.astro` renders generated completed and blocked examples without client-side execution

- [ ] **Step 5: Run content and build tests**

Run

```bash
bun test tests/site/content-contract.test.ts
bun --cwd site run build
```

Expected result: a new user can follow only executable commands

- [ ] **Step 6: Commit**

```bash
git add site/src/content/docs site/src/components tests/site/content-contract.test.ts
git commit -m "docs: publish verified first-run journey"
```

### Task 4: Add custom proof pages using StarlightPage

**Files:**
- Create: `site/src/pages/proof/index.astro`
- Create: `site/src/pages/proof/run-trace/[id].astro`
- Create: `site/src/components/ProofIndex.astro`
- Create: `site/src/components/RunTraceInspector.astro`
- Create: `tests/site/custom-pages.test.ts`

**Interfaces:**
- Uses: `StarlightPage` for custom routes
- Consumes: generated trusted Run Trace examples only

- [ ] **Step 1: Write failing custom-route tests**

Require

- Custom pages use Starlight layout rather than a separate shell
- Page title preserves `id="_top"`
- Skip link, header, sidebar, mobile navigation, and right sidebar behavior remain available
- Unknown trace ID returns a real 404
- Trace data is escaped and no raw HTML from findings is rendered

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/site/custom-pages.test.ts`

Expected result: routes do not exist

- [ ] **Step 3: Implement proof index**

Show only generated examples and case studies with exact source commit, Pack version, Playbook digest, final status, and evidence bundle checksum

- [ ] **Step 4: Implement Run Trace inspector**

Render summary, blockers, stages, findings, decisions, repairs, evidence, integrity, and qualified readiness from the schema object

Do not execute browser-side scripts in v1

- [ ] **Step 5: Run route and build tests**

Run

```bash
bun test tests/site/custom-pages.test.ts
bun --cwd site run build
```

Expected result: custom routes preserve Starlight accessibility behavior

- [ ] **Step 6: Commit**

```bash
git add site/src/pages/proof site/src/components/ProofIndex.astro site/src/components/RunTraceInspector.astro tests/site/custom-pages.test.ts
git commit -m "feat: add evidence proof pages"
```

### Task 5: Create the maintained demo repository fixture and reproducible transcript

**Files:**
- Create: `demo/secure-release/package.json`
- Create: `demo/secure-release/src/**`
- Create: `demo/secure-release/tests/**`
- Create: `demo/secure-release/README.md`
- Create: `scripts/demo/run-secure-release-demo.ts`
- Create: `generated/demo/secure-release-transcript.txt`
- Create: `generated/demo/secure-release-trace.json`
- Create: `tests/acceptance/demo-repository.test.ts`

**Interfaces:**
- Produces one intentionally blocked baseline and one fixed follow-up commit state
- Produces transcript and trace from installed CLI

- [ ] **Step 1: Write a failing demo acceptance test**

The baseline must contain

- One deterministic failing test
- One lockfile or dependency hygiene issue that Dokion can report truthfully
- One attempted out-of-scope repair fixture or guarded write boundary
- No embedded credentials or unsafe sample secrets

- [ ] **Step 2: Run the focused test and confirm RED**

Run `bun test tests/acceptance/demo-repository.test.ts`

Expected result: demo and generator do not exist

- [ ] **Step 3: Build the demo runner**

Run Pack preview, capture exact digest, accept through a test identity, execute, export Run Trace, and record commands and exit codes

Use isolated temporary clones so generation cannot mutate the maintained demo source

- [ ] **Step 4: Generate blocked and passing proof**

The blocked run must finish `NOT_READY` or `NO_COMPLETION_CLAIM`

The fixed run must use a separate repository state and may report readiness only within declared scope

- [ ] **Step 5: Add drift checks**

Regeneration must be deterministic except for documented timestamp fields normalized by the generator

- [ ] **Step 6: Run acceptance and site build**

Run

```bash
bun test tests/acceptance/demo-repository.test.ts
bun run scripts/demo/run-secure-release-demo.ts
bun --cwd site run build
```

Expected result: demo proof is generated from real execution

- [ ] **Step 7: Commit**

```bash
git add demo/secure-release scripts/demo generated/demo tests/acceptance/demo-repository.test.ts
git commit -m "test: publish reproducible Secure Release demo"
```

### Task 6: Add accessible browser QA and GitHub Pages deployment

**Files:**
- Create: `site/playwright.config.ts`
- Create: `site/tests/navigation.spec.ts`
- Create: `site/tests/secure-release.spec.ts`
- Create: `site/tests/run-trace.spec.ts`
- Create: `site/tests/accessibility.spec.ts`
- Create: `.github/workflows/docs-pages.yml`
- Create: `tests/contracts/docs-pages-workflow.test.ts`

**Interfaces:**
- Produces GitHub Pages artifact from `site/dist/`
- Uses least-privilege workflow permissions

- [ ] **Step 1: Write failing workflow and browser tests**

Test at

- 375 x 812
- 768 x 1024
- 1280 x 800
- 1440 x 900
- 1920 x 1080

Required flows

- Home to installation
- Installation to Secure Release preview
- Open completed and blocked Run Trace proof
- Keyboard navigation through header, sidebar, content, and proof pages
- 200 percent zoom without horizontal page overflow
- Reduced motion
- JavaScript-disabled content readability where applicable

- [ ] **Step 2: Implement the Pages workflow**

Use read-only checkout for build, Pages artifact upload, and deployment permissions only in the deployment job

Pin external actions to immutable revisions

Do not persist checkout credentials

- [ ] **Step 3: Run browser and accessibility tests**

Run

```bash
bun --cwd site run build
bun --cwd site run test:e2e
bun test tests/contracts/docs-pages-workflow.test.ts
```

Expected result: all target viewports pass with no critical axe violations or page overflow

- [ ] **Step 4: Add performance budgets**

Require local Lighthouse CI scores of at least

- Performance 90
- Accessibility 95
- Best Practices 95
- SEO 95

Document any environment variance without lowering semantic or accessibility gates

- [ ] **Step 5: Commit**

```bash
git add site/playwright.config.ts site/tests .github/workflows/docs-pages.yml tests/contracts/docs-pages-workflow.test.ts site/package.json
git commit -m "ci: verify and deploy Dokion documentation"
```

### Task 7: Run the ten-repository external adoption cohort

**Files:**
- Create: `docs/research/adoption-cohort-protocol.md`
- Create: `docs/research/adoption-cohort-template.md`
- Create: `docs/research/adoption-cohort-results.md`
- Create: `scripts/research/validate-cohort-records.ts`
- Create: `tests/research/adoption-cohort.test.ts`

**Interfaces:**
- Consumes participant-provided consent and sanitized Run Trace or run bundle
- Produces aggregate results without repository secrets or private paths

- [ ] **Step 1: Define the cohort protocol**

Recruit ten repositories not owned by the maintainer across at least three project owners

Record

- Project profile
- Installation outcome
- Time to first proposal
- Proposal validity
- Execution outcome
- First useful finding or blocker
- False completion prevented
- Out-of-scope repair prevented
- User confusion point
- Second run within seven days

- [ ] **Step 2: Define privacy and consent boundaries**

Require written consent before storing any trace

Accept sanitized Run Trace or aggregate answers

Do not collect source code, raw command output, credentials, absolute paths, or private repository URLs

- [ ] **Step 3: Write cohort record validation tests**

Reject records without consent, unsupported outcome values, raw absolute paths, tokens, emails inside evidence fields, or missing Dokion version and Pack digest

- [ ] **Step 4: Run the focused test and confirm RED**

Run `bun test tests/research/adoption-cohort.test.ts`

Expected result: protocol and validator do not exist

- [ ] **Step 5: Implement record validation and aggregate calculations**

Calculate installer to proposal rate, proposal to accepted run rate, median time to proposal, seven-day second-run rate, prevented failure counts, and top confusion points

Do not publish success rates from fewer than ten completed participant records

- [ ] **Step 6: Publish results with limitations**

Separate observed facts, participant statements, product hypotheses, and unresolved failures

List every repository profile excluded from supported scope

- [ ] **Step 7: Run validation**

Run

```bash
bun test tests/research/adoption-cohort.test.ts
bun run scripts/research/validate-cohort-records.ts
```

Expected result: published aggregate values are reproducible from sanitized records

- [ ] **Step 8: Commit**

```bash
git add docs/research scripts/research tests/research/adoption-cohort.test.ts
git commit -m "docs: record Dokion adoption cohort evidence"
```

## PR Completion Gate

The documentation program is complete only when the supported first-run journey works from the site alone, all examples are generated from real execution, browser and accessibility gates pass, GitHub Pages deploys from a least-privilege workflow, ten consented external repository records are validated, CodeRabbit critical and major issues are resolved, and no site claim exceeds the canonical product surface
