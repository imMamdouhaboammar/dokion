import type { ApprovalSubjectType } from "../approvals/approval-store.ts";

export type CliOutputFormat = "human" | "json";

export type CliSimpleCommand =
  | "init"
  | "inspect"
  | "doctor"
  | "plan"
  | "run"
  | "resume"
  | "verify"
  | "status"
  | "report"
  | "findings"
  | "configure"
  | "audit";

export type CliCatalogCommand = "tools" | "skills" | "plugins" | "loops" | "goals";

type CliCommandInvocation =
  | { command: "help" }
  | { command: CliSimpleCommand }
  | { command: "validate"; catalogOnly: boolean }
  | {
      command: "step";
      stepId: string;
    }
  | {
      command: "skip";
      stepId: string;
      reason: string;
      by?: string;
    }
  | {
      command: "reset";
      stateOnly: boolean;
    }
  | {
      command: "approve" | "reject";
      subject: string;
      subjectType: ApprovalSubjectType;
      by: string;
      notes?: string;
    }
  | { command: CliCatalogCommand; action: "list" }
  | {
      command: "loop";
      subcommand: "audit" | "init" | "cost" | "sync" | "context";
      pattern?: string;
    }
  | {
      command: "goal";
      subcommand: "audit" | "doctor" | "init" | "estimate" | "status" | "pause" | "resume" | "clear" | "sync" | "run";
      pattern?: string;
      level?: string;
      objective?: string;
    }
  | {
      command: "playbooks";
      subcommand: "import" | "validate" | "sync" | "list";
      from?: string;
    }
  | {
      command: "hooks";
      subcommand: "run" | "status";
    }
  | {
      command: "autopilot";
      dryRun?: boolean;
      maxTurns?: number;
    }
  | {
      command: "memory";
      subcommand: "audit" | "init" | "status" | "patterns";
      pattern?: string;
      tool?: string;
      force?: boolean;
      withLoop?: boolean;
      suggest?: boolean;
    }
  | {
      command: "compare";
      baselineRunId?: string;
      targetRunId?: string;
    }
  | {
      command: "auto-runner";
      options: Map<string, true | string>;
      flags: Set<string>;
    }
  | {
      command: "autoresearch";
      positionals: string[];
      options: Map<string, true | string>;
      flags: Set<string>;
      dryRun?: boolean;
    }
  | {
      command: "create";
      fromMemory?: string;
      transcript?: string;
      topic?: string;
      output?: string;
    }
  | {
      command: "hub";
      action?: "search" | "pull" | "publish" | "leaderboard" | "rate" | "fork" | "merge";
      query?: string;
      packageId?: string;
      category?: string;
      author?: string;
    };

export type CliInvocation = CliCommandInvocation & { format: CliOutputFormat };
