import { describe, test, expect } from 'bun:test';
import { validateFileScope } from '../../src/validation/scope-guard';

describe('EXEC-006 Scope Guard', () => {
  test('allows files within declared write scope', () => {
    const result = validateFileScope(['src/cli.ts', 'src/engine/runner.ts'], ['src/']);
    expect(result.allowed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('detects violation when file is outside allowed scope', () => {
    const result = validateFileScope(['src/cli.ts', 'package.json'], ['src/']);
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0]).toContain('package.json');
  });
});
