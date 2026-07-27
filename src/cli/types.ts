import type { ApprovalSubjectType } from "../approvals/approval-store.ts";

export type CliSimpleCommand =
  | "init"
  | "inspect"
  | "doctor"
  | "run"
  | "resume"
  | "verify"
  | "status"
  | "report"
  | "findings";

export type CliCatalogCommand = "tools" | "skills" | "plugins" | "loops";

export type CliInvocation =
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
