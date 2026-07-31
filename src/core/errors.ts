export type DokionErrorCode =
  | "NO_ACTIVE_PLAYBOOK"
  | "INVALID_JSON"
  | "INVALID_MANIFEST"
  | "INVALID_PLAYBOOK"
  | "INVALID_STATE"
  | "INVALID_EVENT"
  | "UNPINNED_CAPABILITY"
  | "PLAYBOOK_TAINTED"
  | "WORKTREE_POLICY_UNAVAILABLE"
  | "DIRTY_WORKTREE_BLOCKED"
  | "WORKTREE_SNAPSHOT_FAILED"
  | "STATE_NOT_FOUND"
  | "GOAL_NOT_FOUND"
  | "STATE_REVISION_CONFLICT"
  | "STATE_WRITE_LOCKED"
  | "RUN_LOCKED"
  | "RUN_LOCK_STALE"
  | "INVALID_RUN_LOCK"
  | "APPROVAL_REQUIRED"
  | "COMMAND_FAILED"
  | "DEPENDENCY_UNMET"
  | "UNSUPPORTED_EXECUTION"
  | "CLI_UNKNOWN_COMMAND"
  | "CLI_PLANNED_COMMAND"
  | "CLI_UNKNOWN_OPTION"
  | "CLI_MISSING_OPTION_VALUE"
  | "CLI_DUPLICATE_OPTION"
  | "CLI_MISSING_ARGUMENT"
  | "CLI_INVALID_ARGUMENT";

export class DokionError extends Error {
  readonly code: DokionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: DokionErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "DokionError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
