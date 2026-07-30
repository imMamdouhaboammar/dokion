import type { CapabilityLock, CapabilityLockEntry } from './lock';

export function resolveCapabilityExecutable(
  lock: CapabilityLock,
  capabilityName: string
): CapabilityLockEntry | undefined {
  return lock.capabilities[capabilityName];
}
