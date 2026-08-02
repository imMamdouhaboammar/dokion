import { db, Superpower } from '../db';

export const OBRA_SUPERPOWERS_SUITE: Omit<Superpower, 'id' | 'installedAt'>[] = [
  {
    name: 'Obra Superpowers: Master Framework',
    repoUrl: 'https://github.com/obra/superpowers',
    description: 'An agentic skills framework & software development methodology for AI coding assistants.',
    instructions: 'Master orchestration skill: enforce systematic brainstorming, TDD cycle, subagent dispatch, root-cause debugging, and mandatory completion verification.',
    category: 'METHODOLOGY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Brainstorming',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/brainstorming',
    description: 'MUST use before any creative work. Explores user intent, requirements, and design before implementation.',
    instructions: 'Do NOT write code before design approval. Explore project context, ask 1 clarifying question at a time, propose 2-3 approaches with trade-offs, and write design spec to docs/superpowers/specs/.',
    category: 'METHODOLOGY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Systematic Debugging',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/systematic-debugging',
    description: 'Use when encountering any bug or failure. Enforces Iron Law: NO fixes without root cause investigation first.',
    instructions: 'Iron Law: NO fixes without root cause investigation first. Trace exact file, line, and root cause. Never apply trial-and-error symptom patches.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Test-Driven Development (TDD)',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/test-driven-development',
    description: 'Use when implementing features or bugfixes. Write test first, watch it fail, write minimal code to pass.',
    instructions: 'Red-Green-Refactor cycle: Write failing test first, verify failure output, implement minimal passing code, and refactor while keeping tests green.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Subagent-Driven Development',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/subagent-driven-development',
    description: 'Execute implementation plans by dispatching fresh subagents with isolated context per task.',
    instructions: 'Dispatch fresh subagents for independent plan tasks, enforce task-level spec compliance and code review, and run final whole-branch review.',
    category: 'AGENT',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Executing Plans',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/executing-plans',
    description: 'Iterative task execution from approved design specifications with continuous verification.',
    instructions: 'Execute plan tasks sequentially, verify each task with automated tests/lint, update progress ledger, and preserve session context.',
    category: 'AGENT',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Verification Before Completion',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/verification-before-completion',
    description: 'Mandatory verification checklist & evidence gathering before considering any task complete.',
    instructions: 'Verify build success, run linter audit, check mobile layout and keyboard accessibility, verify zero regressions, and state concrete evidence.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Requesting Code Review',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/requesting-code-review',
    description: 'Formal code review requests with defect tracking, security checks, and regression guards.',
    instructions: 'Conduct rigorous code review focusing on bugs, security vulnerabilities, edge cases, regression risks, and architectural consistency.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Writing Plans',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/writing-plans',
    description: 'Creates bite-sized, actionable implementation blueprints with explicit verification gates.',
    instructions: 'Deconstruct design specs into atomic, testable tasks. Define clear input/output boundaries, test requirements, and target files for each step.',
    category: 'METHODOLOGY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Writing Skills',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/writing-skills',
    description: 'Synthesizes structured SKILL.md packages with prompt directives, trigger rules, and examples.',
    instructions: 'Format skill definitions with YAML frontmatter (name, description), clear trigger conditions, hard gates, anti-patterns, and concrete workflows.',
    category: 'METHODOLOGY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Dispatching Parallel Agents',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/dispatching-parallel-agents',
    description: 'Parallelized worker dispatch for independent file operations and concurrent research tasks.',
    instructions: 'Identify non-blocking parallel tasks, spawn concurrent subagents with precise context scopes, and synthesize results cleanly.',
    category: 'AGENT',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Finishing a Development Branch',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/finishing-a-development-branch',
    description: 'Clean branch finalization, changelog update, documentation check, and release readiness.',
    instructions: 'Run full verification suite, clean git worktree, update documentation/AGENTS.md, and present final audit summary.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Receiving Code Review',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/receiving-code-review',
    description: 'Systematic feedback processing, root cause analysis for review findings, and fix verification.',
    instructions: 'Evaluate review findings objectively, analyze root cause of identified flaws, apply surgical fixes, and re-verify without regression.',
    category: 'QUALITY',
    enabled: true
  },
  {
    name: 'Obra Superpowers: Using Git Worktrees',
    repoUrl: 'https://github.com/obra/superpowers/tree/main/skills/using-git-worktrees',
    description: 'Isolated environment management for concurrent feature branches and subagent workspaces.',
    instructions: 'Create isolated git worktrees for independent subagents to prevent state corruption across parallel development tracks.',
    category: 'AGENT',
    enabled: true
  }
];

export const SEO_BOOSTER_SUPERPOWERS: Omit<Superpower, 'id' | 'installedAt'>[] = [
  {
    name: 'AEO Answer Box Snippet Booster',
    repoUrl: 'https://github.com/skillaude/aeo-booster',
    description: 'Optimizes content for zero-click direct search answers, Perplexity summaries, and Google AI Overviews.',
    instructions: 'Include a crisp 40-60 word Direct Answer Snippet immediately after the main H1 heading, formatted with bolded key entities and a clear definition block.',
    category: 'AEO',
    enabled: true
  },
  {
    name: 'GEO Citation & E-E-A-T Maximizer',
    repoUrl: 'https://github.com/skillaude/geo-eeat',
    description: 'Injects authoritative citations, expert perspective framework, statistical tables, and Generative Engine Optimization signals.',
    instructions: 'Incorporate concrete statistical data points, expert commentary quotes, structured comparison tables, and E-E-A-T signals to maximize LLM citation weight.',
    category: 'GEO',
    enabled: true
  },
  {
    name: 'Semantic LSI Keyword Expansion Engine',
    repoUrl: 'https://github.com/skillaude/semantic-lsi',
    description: 'Extracts latent semantic indexing terms and entities for high topical authority.',
    instructions: 'Identify and integrate 8-12 contextual sub-entities and semantic LSI keywords naturally into section headers and paragraph copy.',
    category: 'SEO',
    enabled: true
  },
  {
    name: 'Schema.org JSON-LD Synthesizer',
    repoUrl: 'https://github.com/skillaude/schema-ld',
    description: 'Generates valid Schema.org Article, FAQPage, and HowTo JSON-LD structured data blocks.',
    instructions: 'Synthesize machine-readable JSON-LD schema markup including Article, Author, Publisher, FAQPage, and BreadcrumbList schemas.',
    category: 'SEO',
    enabled: true
  }
];

export const DEFAULT_SUPERPOWERS: Omit<Superpower, 'id' | 'installedAt'>[] = [
  ...OBRA_SUPERPOWERS_SUITE,
  ...SEO_BOOSTER_SUPERPOWERS
];

export async function installObraSuperpowers(): Promise<{ count: number; installed: string[] }> {
  const existing = await db.superpowers.toArray();
  const existingNames = new Set(existing.map(s => s.name.toLowerCase()));
  const now = Date.now();
  const installed: string[] = [];

  for (const sp of OBRA_SUPERPOWERS_SUITE) {
    if (!existingNames.has(sp.name.toLowerCase())) {
      const superpowerId = crypto.randomUUID();
      await db.superpowers.add({
        ...sp,
        id: superpowerId,
        installedAt: now
      });
      installed.push(sp.name);

      // Also register as a Skill project in Dexie so it shows up in Library & Editor
      const projectId = crypto.randomUUID();
      await db.projects.add({
        id: projectId,
        name: sp.name,
        description: sp.description,
        type: 'OTHER',
        status: 'Deployed',
        createdAt: now,
        updatedAt: now
      });

      await db.skills.add({
        id: crypto.randomUUID(),
        projectId: projectId,
        name: sp.name,
        instructions: sp.instructions,
        triggers: [sp.name.toLowerCase(), 'superpowers', sp.category.toLowerCase()],
        examples: [{ input: `Use ${sp.name}`, output: `Applied ${sp.name} methodology guidelines.` }],
        tools: { webSearch: true, codeInterpreter: true },
        createdAt: now,
        updatedAt: now
      });

      await db.sessions.add({
        id: crypto.randomUUID(),
        projectId: projectId,
        lastActive: now,
        progress: 100,
        context: `Installed from ${sp.repoUrl}`
      });
    }
  }

  return { count: installed.length, installed };
}

export async function ensureDefaultSuperpowers(): Promise<void> {
  const count = await db.superpowers.count();
  if (count === 0) {
    await installObraSuperpowers();
    const now = Date.now();
    for (const sp of SEO_BOOSTER_SUPERPOWERS) {
      await db.superpowers.add({
        ...sp,
        id: crypto.randomUUID(),
        installedAt: now
      });
    }
  } else {
    // Check if Obra superpowers exist, if not install any missing ones
    await installObraSuperpowers();
  }
}

