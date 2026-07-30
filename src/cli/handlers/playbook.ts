import { listBuiltInPlaybooks, getBuiltInPlaybook, type BuiltInPlaybookMetadata } from '../../playbook/registry';

export function handlePlaybookListCommand(): BuiltInPlaybookMetadata[] {
  return listBuiltInPlaybooks();
}

export function handlePlaybookInspectCommand(id: string): BuiltInPlaybookMetadata | { error: string } {
  const pb = getBuiltInPlaybook(id);
  if (!pb) {
    return { error: `Playbook not found: ${id}` };
  }
  return pb;
}
