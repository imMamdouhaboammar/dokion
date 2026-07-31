import { LifecycleHookEngine } from '../../playbook-integration/hooks.js';
import { writeCliResult } from '../output.js';

export async function handleHooksCommand(args: string[], cwd: string = process.cwd()): Promise<number> {
  const subcommand = args[0] || 'status';
  const engine = new LifecycleHookEngine(cwd);

  if (subcommand === 'status') {
    const state = engine.getHooksState();
    writeCliResult({
      version: state.version,
      updatedAt: state.updatedAt,
      totalHistory: state.history.length,
      recentHistory: state.history.slice(-5)
    }, 'human');
    return 0;
  }

  if (subcommand === 'run') {
    const records = engine.evaluateTrigger('*', [
      { targetSkill: 'self-improving-agent', mode: 'background', reason: 'Session learning capture' },
      { targetSkill: 'code-reviewer', mode: 'auto', reason: 'Automated post-implementation review' }
    ]);
    writeCliResult({
      triggeredCount: records.length,
      records
    }, 'human');
    return 0;
  }

  writeCliResult({
    usage: 'dokion hooks <status|run>'
  }, 'human');
  return 0;
}
