import {
  auditMemoryRepository,
  formatMemoryAuditHuman,
  initMemoryRepository,
  listMemoryPatterns,
  getMemoryPattern,
} from '../../memory-engineering';

export interface MemoryCommandOptions {
  subcommand?: string | undefined;
  targetDir?: string | undefined;
  pattern?: string | undefined;
  tool?: string | undefined;
  force?: boolean | undefined;
  withLoop?: boolean | undefined;
  suggest?: boolean | undefined;
  json?: boolean | undefined;
}


export async function handleMemoryCommand(options: MemoryCommandOptions = {}): Promise<number> {
  const sub = options.subcommand || 'audit';
  const target = options.targetDir || '.';

  switch (sub) {
    case 'audit': {
      const result = await auditMemoryRepository(target);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatMemoryAuditHuman(result));
        if (options.suggest && result.recommendations.length > 0) {
          console.log('\nRecommendations:');
          for (const rec of result.recommendations) {
            console.log(`  → ${rec}`);
          }
        }
      }
      return result.level === 'M0' ? 1 : 0;
    }

    case 'init': {
      const pattern = options.pattern || 'session-scratchpad';
      const result = await initMemoryRepository(target, {
        pattern,
        tool: options.tool || 'grok',
        force: options.force,
        withLoop: options.withLoop,
      });

      console.log(`Memory Engineering Initialized → ${result.root}`);
      console.log(`Pattern: ${result.pattern}  |  Tool Adapter: ${result.tool}\n`);
      for (const item of result.written) {
        console.log(`  ${item.status.padEnd(12)} ${item.path}`);
      }

      console.log('\n--- Memory Audit Post-Init ---');
      const audit = await auditMemoryRepository(result.root);
      console.log(formatMemoryAuditHuman(audit));
      return 0;
    }

    case 'status': {
      const result = await auditMemoryRepository(target);
      console.log(`Memory Posture Status for: ${result.target}`);
      console.log(`Score: ${result.score}/100 | Maturity Level: ${result.level} (${result.levelLabel})`);
      console.log(`Assessment: ${result.assessment}`);
      return 0;
    }

    case 'patterns': {
      console.log('Available Memory Engineering Patterns:\n');
      const patterns = listMemoryPatterns();
      for (const p of patterns) {
        console.log(`• ${p.id.padEnd(22)} [${p.tier}] - ${p.name}`);
        console.log(`  ${p.description}`);
        console.log(`  Best For: ${p.bestFor}\n`);
      }
      return 0;
    }

    default: {
      console.error(`Unknown memory subcommand: "${sub}". Available: audit, init, status, patterns`);
      return 1;
    }
  }
}
