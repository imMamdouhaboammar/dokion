export type TelemetryEventType =
  | "PLAYBOOK_PULLED"
  | "PLAYBOOK_EXECUTED"
  | "STEP_FAILED"
  | "RUN_COMPLETED"
  | "PLAYBOOK_PUBLISHED"
  | "PLAYBOOK_RATED";

export interface TelemetryEvent {
  eventId: string;
  eventType: TelemetryEventType;
  packageId: string;
  digest: string;
  timestamp: string;
  anonymousSessionId: string;
  durationMs?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TelemetryConfig {
  enabled: boolean;
  anonymousSessionId: string;
  spoolDirectory: string;
}
