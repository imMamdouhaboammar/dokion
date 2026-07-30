import type { CapabilityLock } from './lock';

export interface CapabilityVerificationResult {
  verified: boolean;
  mismatches: Array<{ capabilityName: string; reason: string }>;
}

export function verifyCapabilityDigests(
  lock: CapabilityLock,
  observedDigests?: Record<string, string>
): CapabilityVerificationResult {
  const mismatches: Array<{ capabilityName: string; reason: string }> = [];

  for (const [name, entry] of Object.entries(lock.capabilities)) {
    if (observedDigests && observedDigests[name]) {
      const observed = observedDigests[name];
      if (observed !== entry.digest) {
        mismatches.push({
          capabilityName: name,
          reason: `Digest mismatch: expected ${entry.digest}, observed ${observed}`,
        });
      }
    }
  }

  return {
    verified: mismatches.length === 0,
    mismatches,
  };
}
