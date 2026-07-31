import type { DokionPlaybook, PlaybookStep } from "../playbook/types.js";

export type MemorySourceType =
  | "agent-kernel"
  | "transcript"
  | "mem0"
  | "workflow-optimizer"
  | "vector-db"
  | "qdrant"
  | "chromadb"
  | "knowledge-graph"
  | "adr"
  | "github-pr"
  | "github-issue"
  | "manual";

export interface MemoryEntry {
  id: string;
  source: MemorySourceType;
  timestamp: string;
  title: string;
  content: string;
  category?: "ui-ux" | "security" | "backend" | "testing" | "unslop" | "general" | "architecture";
  metadata?: Record<string, unknown>;
}

export interface ExtractedActionStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  skillsToAdd?: string[];
  toolsToInvoke?: string[];
  verificationCommands?: string[];
  category?: string;
  dependencies?: string[];
}

export interface MemoryDriver {
  name: MemorySourceType;
  fetchMemories(options?: Record<string, unknown>): Promise<MemoryEntry[]>;
}

export interface CreatorEngineOptions {
  source?: MemorySourceType;
  transcriptPath?: string;
  conversationId?: string;
  topic?: string;
  outputPath?: string;
  customMemories?: MemoryEntry[];
  interactive?: boolean;
}

export interface PlaybookCreationResult {
  success: boolean;
  playbookPath: string;
  playbook: DokionPlaybook;
  extractedStepsCount: number;
  memoryEntriesProcessed: number;
  digest: string;
  errors?: string[];
}
