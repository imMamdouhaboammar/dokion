export type ApprovalPolicyEnum =
  | 'NEVER'
  | 'FROM_PLAYBOOK'
  | 'BEFORE_EXECUTION'
  | 'BEFORE_WRITE'
  | 'BEFORE_EACH_FIX'
  | 'BEFORE_COMMIT'
  | 'ALWAYS';

export interface ApprovalContext {
  policy: ApprovalPolicyEnum;
  hasUserApproval: boolean;
  actionType: 'EXECUTE' | 'WRITE' | 'FIX' | 'COMMIT';
  approvedSubject?: string;
  targetSubject?: string;
}

export interface ApprovalDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
}

export function evaluateApprovalBoundary(context: ApprovalContext): ApprovalDecision {
  const { policy, hasUserApproval, actionType, approvedSubject, targetSubject } = context;

  if (policy === 'NEVER') {
    return {
      allowed: false,
      requiresApproval: true,
      reason: 'Approval policy NEVER strictly forbids automated execution',
    };
  }

  if (policy === 'ALWAYS') {
    if (!hasUserApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Approval policy ALWAYS requires explicit approval for every action',
      };
    }
  }

  if (policy === 'BEFORE_EXECUTION' && actionType === 'EXECUTE') {
    if (!hasUserApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Approval required BEFORE_EXECUTION',
      };
    }
  }

  if (policy === 'BEFORE_WRITE' && actionType === 'WRITE') {
    if (!hasUserApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Approval required BEFORE_WRITE',
      };
    }
  }

  if (policy === 'BEFORE_EACH_FIX' && actionType === 'FIX') {
    if (!hasUserApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Approval required BEFORE_EACH_FIX',
      };
    }
  }

  if (policy === 'BEFORE_COMMIT' && actionType === 'COMMIT') {
    if (!hasUserApproval) {
      return {
        allowed: false,
        requiresApproval: true,
        reason: 'Approval required BEFORE_COMMIT',
      };
    }
  }

  if (hasUserApproval && targetSubject && approvedSubject && targetSubject !== approvedSubject) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: `Approval subject mismatch: expected ${targetSubject}, got ${approvedSubject}`,
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    reason: 'Action allowed under current approval policy',
  };
}
