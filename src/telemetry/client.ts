import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TelemetryConfig, TelemetryEvent, TelemetryEventType } from "./types.ts";

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
      writeFileSync(eventsPath, JSON.stringify(event) + "\n", { flag: "a" });
    } catch {}
  }

  public getSpooledEvents(): TelemetryEvent[] {
    const eventsPath = join(this.config.spoolDirectory, "events.ndjson");
    if (!existsSync(eventsPath)) return [];
    try {
      const lines = readFileSync(eventsPath, "utf-8").trim().split("\n");
      return lines.filter(Boolean).map((line) => JSON.parse(line) as TelemetryEvent);
    } catch {
      return [];
    }
  }
}
