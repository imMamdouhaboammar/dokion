import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
    expect(events.length).toBeGreaterThan(0);
  });
});
