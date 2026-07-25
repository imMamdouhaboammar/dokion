import type { AgentPlatform, PlatformDegradation, PlatformGuarantees, PlatformProfile } from "./types.ts";

const agents: AgentPlatform[] = ["claude_code", "codex", "gemini_cli", "other"];

function enabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

function explicitAgent(env: Record<string, string | undefined>): AgentPlatform | undefined {
  const value = env.DOKION_AGENT;
  if (!value) return undefined;
  if (!agents.includes(value as AgentPlatform)) throw new Error(`Unsupported DOKION_AGENT: ${value}`);
  return value as AgentPlatform;
}

function inferredAgents(env: Record<string, string | undefined>): AgentPlatform[] {
  const detected = new Set<AgentPlatform>();
  if (env.CLAUDE_PROJECT_DIR || env.CLAUDE_CODE || env.CLAUDE_PLUGIN_ROOT || env.CLAUDE_CODE_REMOTE) detected.add("claude_code");
  if (env.CODEX_HOME || env.CODEX_CI || env.CODEX_SANDBOX || env.CODEX_THREAD_ID) detected.add("codex");
  if (env.GEMINI_CLI || env.GEMINI_EXTENSION_PATH || env.GEMINI_PROJECT_DIR) detected.add("gemini_cli");
  return Array.from(detected);
}

function guarantees(env: Record<string, string | undefined>): PlatformGuarantees {
  return {
    hook_enforcement: enabled(env.DOKION_GUARANTEE_HOOK_ENFORCEMENT),
    subagent_isolation: enabled(env.DOKION_GUARANTEE_SUBAGENT_ISOLATION),
    parallel_writes: enabled(env.DOKION_GUARANTEE_PARALLEL_WRITES),
    worktree_isolation: enabled(env.DOKION_GUARANTEE_WORKTREE_ISOLATION)
  };
}

function degradations(value: PlatformGuarantees): PlatformDegradation[] {
  const result: PlatformDegradation[] = [];
  if (!value.hook_enforcement) result.push("NO_HOOK_ENFORCEMENT");
  if (!value.subagent_isolation) result.push("NO_SUBAGENT_ISOLATION");
  if (!value.parallel_writes) result.push("NO_PARALLEL_WRITES");
  if (!value.worktree_isolation) result.push("NO_WORKTREE_ISOLATION");
  return result;
}

function platformVersion(agent: AgentPlatform, env: Record<string, string | undefined>): string | undefined {
  if (env.DOKION_AGENT_VERSION) return env.DOKION_AGENT_VERSION;
  if (agent === "claude_code") return env.CLAUDE_CODE_VERSION;
  if (agent === "codex") return env.CODEX_VERSION;
  if (agent === "gemini_cli") return env.GEMINI_CLI_VERSION;
  return undefined;
}

export function detectAgentPlatform(env: Record<string, string | undefined> = process.env): PlatformProfile {
  const explicit = explicitAgent(env);
  const inferred = inferredAgents(env);
  const agent = explicit ?? (inferred.length === 1 ? inferred[0]! : "other");
  const detectedBy = explicit
    ? "DOKION_AGENT"
    : inferred.length === 1
      ? agent === "claude_code"
        ? "CLAUDE_ENV"
        : agent === "codex"
          ? "CODEX_ENV"
          : "GEMINI_ENV"
      : inferred.length > 1
        ? "AMBIGUOUS_ENV"
        : "NO_AGENT_MARKER";
  const availableGuarantees = guarantees(env);
  const version = platformVersion(agent, env);
  const model = env.DOKION_MODEL;

  return {
    agent,
    detected_by: detectedBy,
    ...(version ? { version } : {}),
    ...(model ? { model } : {}),
    guarantees: availableGuarantees,
    degradations: degradations(availableGuarantees)
  };
}
