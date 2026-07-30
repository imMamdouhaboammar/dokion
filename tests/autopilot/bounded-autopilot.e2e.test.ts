import { describe, test, expect } from 'bun:test';
import { runAutopilot } from '../../src/autopilot/run-autopilot';
import { handleVerifyCommand } from '../../src/cli/handlers/verify';
import { handleAuditCommand } from '../../src/cli/handlers/audit';

describe('CORE-012 Bounded Autopilot End-to-End Acceptance', () => {
  test('executes full bounded autopilot lifecycle: dry-run, execution, verification, and audit', async () => {
    const playbook = {
      id: 'e2e-playbook',
      name: 'End-to-End Autopilot Playbook',
      steps: [
        { id: 's1', command: 'echo step1', type: 'VERIFY' as const },
        { id: 's2', command: 'echo step2', type: 'GATE' as const, dependsOn: ['s1'] },
      ],
    };

    // 1. Dry-run trace
    const dryRunResult = await runAutopilot({
      playbook,
      state: null,
      dryRun: true,
    });
    expect(dryRunResult.message).toContain('Dry-run mode');
    expect(dryRunResult.lastAction?.action?.stepId).toBe('s1');

    // 2. Autopilot execution
    const runResult = await runAutopilot({
      playbook,
      state: null,
      hasUserApproval: true,
    });
    expect(runResult.turnsExecuted).toBeGreaterThan(0);

    // 3. Re-run verification gates
    const verifyResult = await handleVerifyCommand({ dryRun: true }, null);
    expect(verifyResult.passed).toBe(true);

    // 4. Evidence audit
    const auditResult = handleAuditCommand([
      { path: '.dokion/evidence/e2e.log', content: 'E2E execution log' },
    ]);
    expect(auditResult.audited).toBe(true);
    expect(auditResult.manifest.entries.length).toBe(1);
  });
});
