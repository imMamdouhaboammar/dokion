import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appendEvent, EVENTS_PATH, readEvents } from "../../src/state/event-log.ts";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-events-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await mkdir(join(root, "schemas"), { recursive: true });
  const schema = Bun.file(join(process.cwd(), "schemas/dokion-event.schema.json"));
  if (await schema.exists()) await Bun.write(join(root, "schemas/dokion-event.schema.json"), schema);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("typed event records", () => {
  test("assigns schema version and monotonic per-run sequences", async () => {
    const root = await createRoot();
    const actor = { type: "runtime" as const, id: "dokion-runtime" };

    const first = await appendEvent(root, {
      at: "2026-07-27T16:00:00.000Z",
      run_id: "run-a",
      actor,
      event: "RUN_RESUMED",
      payload: {}
    });
    const second = await appendEvent(root, {
      at: "2026-07-27T16:00:01.000Z",
      run_id: "run-a",
      actor,
      event: "STEP_STARTED",
      payload: { stage_id: "stage-1", step_id: "step-1" }
    });
    const otherRun = await appendEvent(root, {
      at: "2026-07-27T16:00:02.000Z",
      run_id: "run-b",
      actor,
      event: "RUN_COMPLETED",
      payload: {}
    });

    expect(first).toMatchObject({ schema_version: 1, sequence: 1, run_id: "run-a", actor, event: "RUN_RESUMED", payload: {} });
    expect(second.sequence).toBe(2);
    expect(otherRun.sequence).toBe(1);
    expect(await readEvents(root)).toEqual([first, second, otherRun]);
  });

  test("rejects an invalid typed payload before append", async () => {
    const root = await createRoot();

    await expect(appendEvent(root, {
      at: new Date().toISOString(),
      run_id: "run-a",
      actor: { type: "runtime", id: "dokion-runtime" },
      event: "STEP_FAILED",
      payload: { stage_id: "stage-1", step_id: "step-1" }
    } as never)).rejects.toMatchObject({ code: "INVALID_EVENT" });

    await expect(access(join(root, EVENTS_PATH))).rejects.toBeDefined();
  });

  test("rejects invalid persisted events when reading", async () => {
    const root = await createRoot();
    await writeFile(join(root, EVENTS_PATH), `${JSON.stringify({
      schema_version: 1,
      sequence: 1,
      at: new Date().toISOString(),
      run_id: "run-a",
      actor: { type: "runtime", id: "dokion-runtime" },
      event: "RUN_COMPLETED",
      payload: { unexpected: true }
    })}\n`);

    await expect(readEvents(root)).rejects.toMatchObject({ code: "INVALID_EVENT" });
  });

  test("serializes concurrent appends without duplicate sequences", async () => {
    const root = await createRoot();
    const events = await Promise.all(Array.from({ length: 20 }, (_, index) => appendEvent(root, {
      at: new Date(Date.UTC(2026, 6, 27, 16, 1, index)).toISOString(),
      run_id: "run-concurrent",
      actor: { type: "runtime", id: "dokion-runtime" },
      event: "STEP_SUCCEEDED",
      payload: { stage_id: "stage-1", step_id: `step-${index + 1}` }
    })));

    expect(events.map((event) => event.sequence).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    const persisted = await readEvents(root);
    expect(persisted.map((event) => event.sequence)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });
});
