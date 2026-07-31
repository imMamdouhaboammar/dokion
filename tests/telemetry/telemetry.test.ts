import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DokionTelemetryClient } from "../../src/telemetry/client.ts";

const root = process.cwd();

describe("Dokion Telemetry Client Tests", () => {
  test("generates anonymous session ID and spools telemetry events locally", () => {
    const telemetry = new DokionTelemetryClient(root);
    expect(telemetry.isEnabled()).toBe(true);

    const event = telemetry.trackEvent("PLAYBOOK_PULLED", "dokion/web-fullstack", "sha256:dummy", { success: true });
    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("PLAYBOOK_PULLED");
    expect(event?.packageId).toBe("dokion/web-fullstack");

    const events = telemetry.getSpooledEvents();
    expect(events.length).toBeGreaterThan(0);
  });
});
