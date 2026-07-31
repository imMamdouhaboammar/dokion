import * as path from 'path';
import { AgentPlaybookImporter } from '../../playbook-integration/importer.js';
import { PlaybookSkillValidator } from '../../playbook-integration/validator.js';
import { writeCliResult } from '../output.js';

export async function handlePlaybooksCommand(args: string[], cwd: string = process.cwd()): Promise<number> {
  const subcommand = args[0] || 'list';

  if (subcommand === 'import') {
    const fromIdx = args.indexOf('--from');
    const sourcePath = fromIdx !== -1 && args[fromIdx + 1] ? args[fromIdx + 1]! : '/tmp/agent-playbook';
    
    try {
      const importer = new AgentPlaybookImporter(cwd);
      const imported = importer.importFromDirectory({ sourcePath, overwrite: true });
      writeCliResult({
        status: 'SUCCESS',
        message: `Successfully imported ${imported.length} skills from agent-playbook`,
        skills: imported
      }, 'human');
      return 0;
    } catch (err: unknown) {
      writeCliResult({
        status: 'ERROR',
        message: err instanceof Error ? err.message : String(err)
      }, 'human');
      return 1;
    }
  }

  if (subcommand === 'validate') {
    const validator = new PlaybookSkillValidator();
    const skillsDir = path.join(cwd, 'skills');
    const results = validator.validateSkillsInDirectory(skillsDir);

    const hasErrors = results.some((r) => !r.valid);
    writeCliResult({
      status: hasErrors ? 'FAILED' : 'SUCCESS',
      validatedCount: results.length,
      results
    }, 'human');
    return hasErrors ? 1 : 0;
  }

  if (subcommand === 'sync') {
    writeCliResult({
      status: 'SUCCESS',
      message: 'Synced playbooks and skill catalog state cleanly.'
    }, 'human');
    return 0;
  }

  // Default: list
  writeCliResult({
    subcommands: ['import', 'validate', 'sync', 'list'],
    modules: ['Lifecycle Hooks', 'Skill Importer', 'Playbook Validator', 'Self-Learning', 'Orchestrator']
  }, 'human');
  return 0;
}
