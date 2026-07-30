import { describe, test, expect } from 'bun:test';
import { handleSkipCommand } from '../../src/cli/handlers/skip';

describe('CORE-009 Auditable Skip Decisions', () => {
  test('records step skip for optional step', () => {
    const result = handleSkipCommand('opt-step-1', 'Not applicable to frontend project', 'mamdouh', false);
    expect(result.accepted).toBe(true);
    expect(result.record?.actor).toBe('mamdouh');
  });

  test('blocks skip for required step', () => {
    const result = handleSkipCommand('req-step-1', 'Want to skip security check', 'mamdouh', true);
    expect(result.accepted).toBe(false);
    expect(result.message).toContain('required and mandatory');
  });
});
