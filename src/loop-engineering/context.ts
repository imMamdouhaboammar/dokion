import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ContextWindowSummary {
  eventsCount: number;
  totalBytes: number;
  estimatedTokens: number;
  maxContextTokens: number;
  usagePercentage: number;
  status: "OPTIMAL" | "WARNING" | "CRITICAL";
  recommendation?: string | undefined;
}

export class LoopContextManager {
  private static MAX_CONTEXT_TOKENS = 200_000; // Standard 200k token context window

  public static auditContext(projectDir: string): ContextWindowSummary {
    const eventsPath = join(projectDir, ".dokion", "events.ndjson");
    if (!existsSync(eventsPath)) {
      return {
        eventsCount: 0,
        totalBytes: 0,
        estimatedTokens: 0,
        maxContextTokens: this.MAX_CONTEXT_TOKENS,
        usagePercentage: 0,
        status: "OPTIMAL",
      };
    }

    try {
      const content = readFileSync(eventsPath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      const totalBytes = Buffer.byteLength(content, "utf8");
      // Rough estimation: 4 bytes ~ 1 token for JSON logs
      const estimatedTokens = Math.round(totalBytes / 4);
      const usagePercentage = Math.round((estimatedTokens / this.MAX_CONTEXT_TOKENS) * 100);

      let status: "OPTIMAL" | "WARNING" | "CRITICAL" = "OPTIMAL";
      let recommendation: string | undefined;

      if (usagePercentage >= 80) {
        status = "CRITICAL";
        recommendation = "Context window is nearly full (>80%). Compact event log using 'dokion loop sync' or start a new state run.";
      } else if (usagePercentage >= 50) {
        status = "WARNING";
        recommendation = "Context window is 50%+ full. Consider pruning non-essential evidence logs.";
      }

      return {
        eventsCount: lines.length,
        totalBytes,
        estimatedTokens,
        maxContextTokens: this.MAX_CONTEXT_TOKENS,
        usagePercentage,
        status,
        ...(recommendation ? { recommendation } : {}),
      };
    } catch {
      return {
        eventsCount: 0,
        totalBytes: 0,
        estimatedTokens: 0,
        maxContextTokens: this.MAX_CONTEXT_TOKENS,
        usagePercentage: 0,
        status: "OPTIMAL",
      };
    }
  }
}
