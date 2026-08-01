import type { ApprovalSubjectType } from "../approvals/approval-store.ts";

export type CliOutputFormat = "human" | "json";

interface CliFormatted {
  format: CliOutputFormat;
}

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

export type CliInvocation =
  | ({ command: "help" } & CliFormatted)
  | ({ command: CliSimpleCommand } & CliFormatted)
  | ({ command: "validate"; catalogOnly: boolean } & CliFormatted)
  | ({ command: "step"; stepId: string } & CliFormatted)
  | ({ command: "skip"; stepId: string; reason: string; by?: string } & CliFormatted)
  | ({ command: "reset"; stateOnly: true } & CliFormatted)
  | ({
      command: "approve" | "reject";
      subject: string;
      subjectType: ApprovalSubjectType;
      by: string;
      notes?: string;
    } & CliFormatted)
  | ({ command: CliCatalogCommand; action: "list" } & CliFormatted)
  | ({
      command: "registry";
      subcommand: "pack";
      directory: string;
      output: string;
      overwrite: boolean;
    } & CliFormatted)
  | ({
      command: "registry";
      subcommand: "verify-package";
      archive: string;
      expectedPackageId?: string;
      expectedVersion?: string;
    } & CliFormatted)
  | ({ command: "loop"; subcommand: "audit" | "init" | "cost" | "sync" | "context"; pattern?: string } & CliFormatted)
  | ({
      command: "goal";
      subcommand: "audit" | "doctor" | "init" | "estimate" | "status" | "pause" | "resume" | "clear" | "sync" | "run";
      pattern?: string;
      level?: string;
      objective?: string;
    } & CliFormatted)
  | ({ command: "playbooks"; subcommand: "import" | "validate" | "sync" | "list"; from?: string } & CliFormatted)
  | ({ command: "hooks"; subcommand: "run" | "status" } & CliFormatted)
  | ({ command: "autopilot"; dryRun: boolean; maxTurns?: number } & CliFormatted)
  | ({
      command: "memory";
      subcommand: "audit" | "init" | "status" | "patterns";
      pattern?: string;
      tool?: string;
      force: boolean;
      withLoop: boolean;
      suggest: boolean;
    } & CliFormatted)
  | ({ command: "compare"; baselineRunId?: string; targetRunId?: string } & CliFormatted)
  | ({ command: "auto-runner"; options: Map<string, true | string>; flags: Set<string> } & CliFormatted)
  | ({
      command: "autoresearch";
      positionals: string[];
      options: Map<string, true | string>;
      flags: Set<string>;
      dryRun: boolean;
    } & CliFormatted)
  | ({ command: "create"; fromMemory?: string; transcript?: string; topic?: string; output?: string } & CliFormatted);
