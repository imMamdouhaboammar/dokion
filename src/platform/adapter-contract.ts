export interface AdapterDefinition {
  id: string;
  version: string;
  supportedCommands: string[];
  hasHookGuarantees: boolean;
  hasFileSystemAccess: boolean;
}

export interface PlatformNegotiationInput {
  adapterId: string;
  os: string;
  hooksAvailable: boolean;
}

export interface PlatformGuarantees {
  adapterId: string;
  hookStatus: "FULL_GUARANTEE" | "DEGRADED_UNAVAILABLE";
  degradations: string[];
}

export interface RunStateForHandoff {
  runId: string;
  lastAdapter: string;
  status: string;
  completedStepIds: string[];
}

export interface ResumeContext {
  resumingAdapter: string;
  resumingUser: string;
}

export interface ResumedState {
  runId: string;
  activeAdapter: string;
  status: string;
  completedStepIds: string[];
  handoffLog: Array<{ fromAdapter: string; toAdapter: string; timestamp: string }>;
}

export function validateAdapterContract(adapter: AdapterDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!adapter.id) errors.push("Missing adapter id");
  if (!adapter.version) errors.push("Missing adapter version");
  if (!adapter.supportedCommands || adapter.supportedCommands.length === 0) errors.push("Adapter must declare supported commands");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function negotiatePlatformGuarantees(input: PlatformNegotiationInput): PlatformGuarantees {
  const degradations: string[] = [];
  let hookStatus: "FULL_GUARANTEE" | "DEGRADED_UNAVAILABLE" = "FULL_GUARANTEE";

  if (!input.hooksAvailable) {
    hookStatus = "DEGRADED_UNAVAILABLE";
    degradations.push("Hook protection is disabled on this adapter");
  }

  return {
    adapterId: input.adapterId,
    hookStatus,
    degradations,
  };
}

export function reconcileCrossAgentResume(
  state: RunStateForHandoff,
  resumeContext: ResumeContext
): ResumedState {
  return {
    runId: state.runId,
    activeAdapter: resumeContext.resumingAdapter,
    status: "RESUMED",
    completedStepIds: state.completedStepIds,
    handoffLog: [
      {
        fromAdapter: state.lastAdapter,
        toAdapter: resumeContext.resumingAdapter,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
