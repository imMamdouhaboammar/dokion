export interface CapabilityLockEntry {
  name: string;
  executablePath: string;
  version?: string;
  digest: string;
  sourceType: 'system' | 'local' | 'git';
  gitCommit?: string;
}

export interface CapabilityLock {
  schema_version: 1;
  updated_at: string;
  capabilities: Record<string, CapabilityLockEntry>;
}

export function createEmptyCapabilityLock(): CapabilityLock {
  return {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    capabilities: {},
  };
}
