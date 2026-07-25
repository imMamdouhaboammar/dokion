export type DokionErrorCode =
  | "NO_ACTIVE_PLAYBOOK"
  | "INVALID_JSON"
  | "INVALID_MANIFEST"
  | "INVALID_PLAYBOOK"
  | "INVALID_STATE"
  | "UNPINNED_CAPABILITY"
  | "PLAYBOOK_TAINTED"
  | "STATE_NOT_FOUND"
  | "APPROVAL_REQUIRED"
  | "COMMAND_FAILED"
  | "DEPENDENCY_UNMET"
  | "UNSUPPORTED_EXECUTION";

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
