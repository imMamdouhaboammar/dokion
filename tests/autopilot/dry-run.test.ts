import { describe, test, expect } from 'bun:test';
import { generateDryRunTrace } from '../../src/autopilot/trace';

describe('CORE-007 Dry-Run Decision Trace', () => {
  test('generates predicted execution step for next action', () => {
    const playbook = {
      id: 'pb-1',
      name: 'Playbook 1',
      steps: [{ id: 's1', command: 'bun test' }],
    };
    const trace = generateDryRunTrace(null, playbook);
    expect(trace.isDeterministic).toBe(true);
    expect(trace.predictedTransitions.length).toBe(1);
    expect(trace.predictedTransitions[0]?.stepId).toBe('s1');
  });

  test('generates stop trace when playbook has no steps', () => {
    const playbook = {
      id: 'pb-empty',
      name: 'Empty Playbook',
      steps: [],
    };
    const trace = generateDryRunTrace(null, playbook);
    expect(trace.predictedTransitions[0]?.status).toBe('PREDICTED_STOP');
  });
});
