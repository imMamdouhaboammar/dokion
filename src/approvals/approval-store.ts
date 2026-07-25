import { StateStore } from "../state/state-store.ts";
import type { DokionState } from "../state/types.ts";

export type ApprovalSubjectType = "step" | "finding" | "fix" | "commit" | "install" | "suggestion" | "deferral";
export type ApprovalDecision = "APPROVED" | "REJECTED" | "MODIFIED" | "DEFERRED";

export interface ApprovalInput {
  subject: string;
  subjectType: ApprovalSubjectType;
  decision: ApprovalDecision;
  by: string;
  notes?: string;
}

export interface ApprovalRecord {
  at: string;
  subject: string;
  subject_type: ApprovalSubjectType;
  decision: ApprovalDecision;
  by: string;
  notes?: string;
}

function approvals(state: DokionState): ApprovalRecord[] {
  return (state.approvals ?? []) as ApprovalRecord[];
}

export async function recordApproval(root: string, input: ApprovalInput): Promise<ApprovalRecord> {
  const record: ApprovalRecord = {
    at: new Date().toISOString(),
    subject: input.subject,
    subject_type: input.subjectType,
    decision: input.decision,
    by: input.by,
    ...(input.notes ? { notes: input.notes } : {})
  };

  const store = new StateStore(root);
  await store.update((state) => ({
    ...state,
    approvals: [...approvals(state), record]
  }));
  return record;
}

export function latestDecision(state: DokionState, subject: string): ApprovalRecord | undefined {
  return approvals(state).filter((record) => record.subject === subject).at(-1);
}

export function isApproved(state: DokionState, subject: string): boolean {
  return latestDecision(state, subject)?.decision === "APPROVED";
}
