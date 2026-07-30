import { describe, test, expect } from 'bun:test';
import { checkRunBudgets } from '../../src/autopilot/run-budget';

describe('CORE-005 Run Budget Evaluator', () => {
  test('passes when usage is within limits', () => {
    const result = checkRunBudgets(
      {
        wallTimeSeconds: 10,
        commandsRun: 2,
        retriesAttempted: 0,
        repairsAttempted: 0,
        findingsCount: 1,
        evidenceSizeBytes: 500,
        changedLinesCount: 10,
      },
      {
        maxWallTimeSeconds: 60,
        maxCommands: 10,
      }
    );
    expect(result.exceeded).toBe(false);
  });

  test('fails when wall time exceeds limit', () => {
    const result = checkRunBudgets(
      {
        wallTimeSeconds: 120,
        commandsRun: 2,
        retriesAttempted: 0,
        repairsAttempted: 0,
        findingsCount: 1,
        evidenceSizeBytes: 500,
        changedLinesCount: 10,
      },
      {
        maxWallTimeSeconds: 60,
      }
    );
    expect(result.exceeded).toBe(true);
    expect(result.exceededBudget).toBe('maxWallTimeSeconds');
  });

  test('fails when commands count reaches limit', () => {
    const result = checkRunBudgets(
      {
        wallTimeSeconds: 10,
        commandsRun: 5,
        retriesAttempted: 0,
        repairsAttempted: 0,
        findingsCount: 1,
        evidenceSizeBytes: 500,
        changedLinesCount: 10,
      },
      {
        maxCommands: 5,
      }
    );
    expect(result.exceeded).toBe(true);
    expect(result.exceededBudget).toBe('maxCommands');
  });
});
