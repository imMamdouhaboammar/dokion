import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TelemetryConfig, TelemetryEvent, TelemetryEventType } from "./types.ts";

const TELEMETRY_EVENT_TYPES = new Set<TelemetryEventType>([
  "PLAYBOOK_PULLED",
  "PLAYBOOK_EXECUTED",
  "STEP_FAILED",
  "RUN_COMPLETED",
  "PLAYBOOK_PUBLISHED",
  "PLAYBOOK_RATED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTelemetryEvent(value: unknown): value is TelemetryEvent {
  if (!isRecord(value)) return false;
  if (typeof value.eventId !== "string" || value.eventId.length === 0) return false;
  if (typeof value.eventType !== "string" || !TELEMETRY_EVENT_TYPES.has(value.eventType as TelemetryEventType)) return false;
  if (typeof value.packageId !== "string" || value.packageId.length === 0) return false;
  if (typeof value.digest !== "string" || value.digest.length === 0) return false;
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) return false;
  if (typeof value.anonymousSessionId !== "string" || value.anonymousSessionId.length === 0) return false;
  if (value.durationMs !== undefined && (typeof value.durationMs !== "number" || !Number.isFinite(value.durationMs))) return false;
  if (value.success !== undefined && typeof value.success !== "boolean") return false;
  if (value.metadata !== undefined && !isRecord(value.metadata)) return false;
  return true;
}

export class DokionTelemetryClient {
  private config: TelemetryConfig;

  constructor(projectRoot: string) {
    const isDisabled = process.env.DOKION_TELEMETRY_DISABLED === "1" || process.env.DOKION_TELEMETRY_DISABLED === "true";
    const spoolDir = join(projectRoot, ".dokion", "telemetry");

    this.config = {
      enabled: !isDisabled,
      anonymousSessionId: this.getOrGenerateSessionId(spoolDir),
      spoolDirectory: spoolDir,
    };
  }

  private getOrGenerateSessionId(spoolDir: string): string {
    if (!existsSync(spoolDir)) {
      mkdirSync(spoolDir, { recursive: true });
    }
    const sessionPath = join(spoolDir, "session.json");
    if (existsSync(sessionPath)) {
      try {
        const parsed = JSON.parse(readFileSync(sessionPath, "utf-8")) as { sessionId?: unknown };
        if (typeof parsed.sessionId === "string" && parsed.sessionId.length > 0) {
          return parsed.sessionId;
        }
      } catch {}
    }
    const newId = createHash("sha256").update(randomUUID() + Date.now()).digest("hex").substring(0, 32);
    try {
      writeFileSync(sessionPath, JSON.stringify({ sessionId: newId, createdAt: new Date().toISOString() }, null, 2));
    } catch {}
    return newId;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public trackEvent(
    eventType: TelemetryEventType,
    packageId: string,
    digest: string,
    metadata?: { durationMs?: number; success?: boolean; extra?: Record<string, unknown> }
  ): TelemetryEvent | null {
    if (!this.config.enabled) return null;

    const event: TelemetryEvent = {
      eventId: randomUUID(),
      eventType,
      packageId,
      digest,
      timestamp: new Date().toISOString(),
      anonymousSessionId: this.config.anonymousSessionId,
      ...(metadata?.durationMs !== undefined ? { durationMs: metadata.durationMs } : {}),
      ...(metadata?.success !== undefined ? { success: metadata.success } : {}),
      ...(metadata?.extra !== undefined ? { metadata: metadata.extra } : {}),
    };

    this.spoolEvent(event);
    return event;
  }

  private spoolEvent(event: TelemetryEvent): void {
    try {
      if (!existsSync(this.config.spoolDirectory)) {
        mkdirSync(this.config.spoolDirectory, { recursive: true });
      }
      const eventsPath = join(this.config.spoolDirectory, "events.ndjson");
      writeFileSync(eventsPath, `${JSON.stringify(event)}\n`, { flag: "a" });
    } catch {}
  }

  public getSpooledEvents(): TelemetryEvent[] {
    const eventsPath = join(this.config.spoolDirectory, "events.ndjson");
    if (!existsSync(eventsPath)) return [];

    const events: TelemetryEvent[] = [];
    for (const line of readFileSync(eventsPath, "utf-8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isTelemetryEvent(parsed)) events.push(parsed);
      } catch {}
    }
    return events;
  }
}
