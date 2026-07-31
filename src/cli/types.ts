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
  | "findings";

export type CliCatalogCommand = "tools" | "skills" | "plugins" | "loops" | "goals";

type CliCommandInvocation =
  | { command: "help" }
  | { command: CliSimpleCommand }
  | { command: "validate"; catalogOnly: boolean }
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
    };

export type CliInvocation = CliCommandInvocation & { format: CliOutputFormat };
