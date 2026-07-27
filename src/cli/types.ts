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

export type CliCatalogCommand = "tools" | "skills" | "plugins" | "loops";

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
  | { command: CliCatalogCommand; action: "list" };

export type CliInvocation = CliCommandInvocation & { format: CliOutputFormat };
