export interface MemoryPatternDefinition {
  id: string;
  name: string;
  description: string;
  tier: 'scratch' | 'episodic' | 'durable' | 'retrieved';
  requiredFiles: string[];
  recommendedSkills: string[];
  bestFor: string;
}

export const MEMORY_PATTERNS: Record<string, MemoryPatternDefinition> = {
  'session-scratchpad': {
    id: 'session-scratchpad',
    name: 'Session Scratchpad',
    description: 'Short-lived session memory for capturing current working notes and open questions.',
    tier: 'scratch',
    requiredFiles: ['MEMORY.md', 'MEMORY-STATE.md', 'memory-constraints.md', 'memory-run-log.md'],
    recommendedSkills: ['memory-write', 'memory-recall'],
    bestFor: 'Agent forgets decisions during long sessions or overnight breaks.',
  },
  'project-episodic-log': {
    id: 'project-episodic-log',
    name: 'Project Episodic Log',
    description: 'Medium-term log of architectural decisions, handoffs, and event sequences.',
    tier: 'episodic',
    requiredFiles: ['MEMORY.md', 'MEMORY-STATE.md', 'memory-budget.md', 'memory-constraints.md', 'memory-run-log.md'],
    recommendedSkills: ['memory-write', 'memory-recall', 'memory-hygiene'],
    bestFor: 'Eliminating disputes over previously agreed-upon technical decisions.',
  },
  'durable-facts-store': {
    id: 'durable-facts-store',
    name: 'Durable Facts Store',
    description: 'Gated long-term repository of verified stack facts, owners, invariants, and hard rules.',
    tier: 'durable',
    requiredFiles: ['MEMORY.md', 'MEMORY-STATE.md', 'memory-budget.md', 'memory-constraints.md', 'memory-run-log.md'],
    recommendedSkills: ['memory-write', 'memory-recall', 'memory-hygiene', 'memory-verifier'],
    bestFor: 'Preventing agents from reloading outdated facts or violating team invariants.',
  },
  'retrieval-budget': {
    id: 'retrieval-budget',
    name: 'Retrieval Budget',
    description: 'Strictly capped context retrieval rules that prevent historical context bloat.',
    tier: 'retrieved',
    requiredFiles: ['MEMORY.md', 'MEMORY-STATE.md', 'memory-budget.md', 'memory-constraints.md', 'memory-run-log.md'],
    recommendedSkills: ['memory-write', 'memory-recall', 'memory-hygiene'],
    bestFor: 'Solving context window bloat and excessive token consumption.',
  },
  'memory-hygiene-loop': {
    id: 'memory-hygiene-loop',
    name: 'Memory Hygiene Loop',
    description: 'Automated background loop that prunes stale notes, verifies facts, and prevents memory decay.',
    tier: 'episodic',
    requiredFiles: ['MEMORY.md', 'MEMORY-STATE.md', 'memory-budget.md', 'memory-constraints.md', 'memory-run-log.md'],
    recommendedSkills: ['memory-write', 'memory-recall', 'memory-hygiene', 'memory-verifier'],
    bestFor: 'Cleaning stale or poisoned memory before it degrades agent performance.',
  },
};

export function getMemoryPattern(id: string): MemoryPatternDefinition | undefined {
  return MEMORY_PATTERNS[id];
}

export function listMemoryPatterns(): MemoryPatternDefinition[] {
  return Object.values(MEMORY_PATTERNS);
}
