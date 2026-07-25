export type AgentPlatform = "claude_code" | "codex" | "gemini_cli" | "other";

export type PlatformDegradation =
  | "NO_HOOK_ENFORCEMENT"
  | "NO_SUBAGENT_ISOLATION"
  | "NO_PARALLEL_WRITES"
  | "NO_WORKTREE_ISOLATION";

export interface PlatformGuarantees {
  hook_enforcement: boolean;
  subagent_isolation: boolean;
  parallel_writes: boolean;
  worktree_isolation: boolean;
}

export interface PlatformProfile {
  agent: AgentPlatform;
  detected_by: string;
  version?: string;
  model?: string;
  guarantees: PlatformGuarantees;
  degradations: PlatformDegradation[];
}
