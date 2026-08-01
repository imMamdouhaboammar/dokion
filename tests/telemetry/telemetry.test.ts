import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DokionTelemetryClient } from "../../src/telemetry/client.ts";

const temporaryRoots: string[] = [];

function createTemporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "dokion-telemetry-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Dokion Telemetry Client Tests", () => {
  test("generates anonymous session ID and spools telemetry events locally", () => {
    const root = createTemporaryRoot();
    const telemetry = new DokionTelemetryClient(root);
    expect(telemetry.isEnabled()).toBe(true);

    const event = telemetry.trackEvent("PLAYBOOK_PULLED", "dokion/web-fullstack", "sha256:dummy", { success: true });
    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("PLAYBOOK_PULLED");
    expect(event?.packageId).toBe("dokion/web-fullstack");

    const events = telemetry.getSpooledEvents();
    expect(events).toHaveLength(1);
  });

  test("returns valid events while rejecting malformed spool lines", () => {
    const root = createTemporaryRoot();
    const telemetry = new DokionTelemetryClient(root);
    telemetry.trackEvent("RUN_COMPLETED", "dokion/test", "sha256:valid", { success: true });

    const spoolPath = join(root, ".dokion", "telemetry", "events.ndjson");
    appendFileSync(spoolPath, "not-json\n");
    appendFileSync(spoolPath, `${JSON.stringify({ eventId: "missing-required-fields" })}\n`);
    appendFileSync(spoolPath, `${JSON.stringify({
      eventId: "bad-type",
      eventType: "UNKNOWN",
      packageId: "dokion/test",
      digest: "sha256:bad",
      timestamp: new Date().toISOString(),
      anonymousSessionId: "session",
    })}\n`);

    const events = telemetry.getSpooledEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe("RUN_COMPLETED");
  });
});
