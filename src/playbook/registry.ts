import { sha256 } from '../core/digest.ts';

export interface BuiltInPlaybookMetadata {
  id: string;
  name: string;
  category: 'web-fullstack' | 'api-service' | 'library-package';
  description: string;
  version: string;
}

export interface PlaybookActivationResult {
  activated: boolean;
  playbookPath: string;
  digest: string;
  message: string;
}

export const BUILTIN_PLAYBOOKS: BuiltInPlaybookMetadata[] = [
  {
    id: 'web-fullstack',
    name: 'Web Fullstack Hardening Playbook',
    category: 'web-fullstack',
    description: 'Comprehensive hardening playbook for web and frontend application repositories',
    version: '1.0.0',
  },
  {
    id: 'api-service',
    name: 'API Service Hardening Playbook',
    category: 'api-service',
    description: 'Hardening playbook for REST, GraphQL, and gRPC backend API microservices',
    version: '1.0.0',
  },
  {
    id: 'library-package',
    name: 'Library & Package Hardening Playbook',
    category: 'library-package',
    description: 'Hardening playbook for published npm/Bun libraries and SDK packages',
    version: '1.0.0',
  },
];

export function listBuiltInPlaybooks(): BuiltInPlaybookMetadata[] {
  return [...BUILTIN_PLAYBOOKS];
}

export function getBuiltInPlaybook(id: string): BuiltInPlaybookMetadata | undefined {
  return BUILTIN_PLAYBOOKS.find((pb) => pb.id === id);
}

export function activatePlaybookContent(
  content: string,
  targetPath: string = '.dokion/playbook.json'
): PlaybookActivationResult {
  const digest = sha256(content);
  return {
    activated: true,
    playbookPath: targetPath,
    digest,
    message: `Activated playbook with SHA-256 digest ${digest} at ${targetPath}`,
  };
}
