import { describe, test, expect } from 'bun:test';
import { evaluateApprovalBoundary } from '../../src/policy/approval-policy';

describe('CORE-002 Approval Policy Evaluator', () => {
  test('disallows action when policy is NEVER', () => {
    const decision = evaluateApprovalBoundary({
      policy: 'NEVER',
      hasUserApproval: true,
      actionType: 'EXECUTE',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
  });

  test('allows action when policy is ALWAYS and user approved', () => {
    const decision = evaluateApprovalBoundary({
      policy: 'ALWAYS',
      hasUserApproval: true,
      actionType: 'EXECUTE',
    });
    expect(decision.allowed).toBe(true);
  });

  test('blocks WRITE action when policy is BEFORE_WRITE and user has not approved', () => {
    const decision = evaluateApprovalBoundary({
      policy: 'BEFORE_WRITE',
      hasUserApproval: false,
      actionType: 'WRITE',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
  });

  test('detects subject mismatch for approval', () => {
    const decision = evaluateApprovalBoundary({
      policy: 'BEFORE_WRITE',
      hasUserApproval: true,
      actionType: 'WRITE',
      approvedSubject: 'step:s1',
      targetSubject: 'step:s2',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('subject mismatch');
  });
});
