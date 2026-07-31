import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getMemoryPattern } from './patterns';

export interface MemoryInitOptions {
  pattern?: string | undefined;
  tool?: string | undefined;
  force?: boolean | undefined;
  withLoop?: boolean | undefined;
}


export interface MemoryInitResult {
  root: string;
  pattern: string;
  tool: string;
  written: Array<{ path: string; status: 'written' | 'overwritten' | 'skipped' }>;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeUnless(
  targetPath: string,
  content: string,
  force: boolean,
): Promise<{ path: string; status: 'written' | 'overwritten' | 'skipped' }> {
  if (!force && (await exists(targetPath))) {
    return { path: targetPath, status: 'skipped' };
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, 'utf8');
  return { path: targetPath, status: force ? 'overwritten' : 'written' };
}

export async function initMemoryRepository(
  targetDir: string,
  options: MemoryInitOptions = {},
): Promise<MemoryInitResult> {
  const pattern = options.pattern || 'session-scratchpad';
  const tool = options.tool || 'grok';
  const force = !!options.force;

  const def = getMemoryPattern(pattern);
  if (!def) {
    throw new Error(`Unknown memory pattern: "${pattern}". Available: session-scratchpad, project-episodic-log, durable-facts-store, retrieval-budget, memory-hygiene-loop`);
  }

  const root = path.resolve(targetDir);
  await mkdir(root, { recursive: true });

  const written: Array<{ path: string; status: 'written' | 'overwritten' | 'skipped' }> = [];
  const nowIso = new Date().toISOString().slice(0, 10);

  // 1. MEMORY.md
  const memoryMdContent = `# Project Memory Posture

- Pattern: ${def.id} (${def.name})
- Tooling: ${tool}
- Initialized: ${nowIso}

## Memory Tiers

1. **Scratch**: Session working notes, open questions, hypotheses.
2. **Episodic**: Event log, handoffs, key decisions.
3. **Durable**: High-confidence stack facts, owners, non-negotiable invariants.
4. **Retrieved**: Capped chunks pulled into prompt context per turn.

## Write Policy
- Scratch is cheap to write; promotion to Durable requires human or verifier review.
- Never write credentials, tokens, or private secrets to memory files.
`;
  written.push(await writeUnless(path.join(root, 'MEMORY.md'), memoryMdContent, force));

  // 2. MEMORY-STATE.md
  const memoryStateContent = `# Live Memory State

Catalog of active remembered facts across sessions.

## Scratch Notes
- [hypothesis] Initializing ${pattern} memory spine.

## Episodic Log
- [decided] Memory pattern configured as ${def.id}.

## Durable Facts
- [observed] Project uses ${tool} integration adapter.
`;
  written.push(await writeUnless(path.join(root, 'MEMORY-STATE.md'), memoryStateContent, force));

  // 3. memory-constraints.md
  const memoryConstraintsContent = `# Memory Constraints & Red Lines

1. **Forbidden Content**: Private keys, API tokens, passwords, customer PII.
2. **Size Bounds**: Keep MEMORY-STATE.md concise; archive or prune old episodic notes.
3. **Promotion Gate**: Do not promote unverified hypotheses to Durable Facts.
`;
  written.push(await writeUnless(path.join(root, 'memory-constraints.md'), memoryConstraintsContent, force));

  // 4. memory-run-log.md
  const memoryRunLogContent = `# Memory Run Log

| Date | Action | Pattern | Notes |
|------|--------|---------|-------|
| ${nowIso} | init | ${pattern} | Initialized memory spine |
`;
  written.push(await writeUnless(path.join(root, 'memory-run-log.md'), memoryRunLogContent, force));

  // 5. memory-budget.md (if pattern requires or budget requested)
  if (def.requiredFiles.includes('memory-budget.md')) {
    const memoryBudgetContent = `# Memory Retrieval Budget

- Max Scratch Entries: 20
- Max Episodic History Days: 30
- Max Durable Facts: 100
- Max Retrieval Tokens Per Turn: 2000
`;
    written.push(await writeUnless(path.join(root, 'memory-budget.md'), memoryBudgetContent, force));
  }

  // 6. MEMORY-PATTERN.md
  const patternPointer = `# Active Memory Pattern

- ID: ${def.id}
- Name: ${def.name}
- Tier: ${def.tier}
- Recommended Skills: ${def.recommendedSkills.join(', ')}
`;
  written.push(await writeUnless(path.join(root, 'MEMORY-PATTERN.md'), patternPointer, force));

  // 7. Skills stubs
  const skillsDir = path.join(root, 'skills');
  for (const skillName of def.recommendedSkills) {
    const skillContent = `---
name: ${skillName}
description: ${skillName} skill for memory engineering (${pattern})
---

# ${skillName}

Provides guidance and operations for ${skillName} in ${pattern}.
`;
    written.push(await writeUnless(path.join(skillsDir, `${skillName}.md`), skillContent, force));
  }

  return {
    root,
    pattern: def.id,
    tool,
    written,
  };
}
