import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

import { validateEventData } from "../contracts/schema-validator.ts";
import { DokionError } from "../core/errors.ts";

export const EVENTS_PATH = ".dokion/events.ndjson";
const EVENT_APPEND_LOCK_PATH = ".dokion/events.append.lock";

export type DokionEventType =
  | "RUN_STARTED"
  | "RUN_RESUMED"
  | "RUN_COMPLETED"
  | "STEP_STARTED"
  | "STEP_SUCCEEDED"
  | "STAGE_INAPPLICABLE"
  | "STEP_INAPPLICABLE"
  | "APPROVAL_REQUIRED"
  | "PLAYBOOK_TAINTED"
  | "STEP_FAILED";

export interface DokionEventActor {
  type: "runtime" | "user" | "capability" | "system";
  id: string;
}

export interface DokionEventPayloadMap {
  RUN_STARTED: { playbook_digest: string; platform: Record<string, unknown> };
  RUN_RESUMED: Record<string, never>;
  RUN_COMPLETED: Record<string, never>;
  STEP_STARTED: { stage_id: string; step_id: string };
  STEP_SUCCEEDED: { stage_id: string; step_id: string };
  STAGE_INAPPLICABLE: { stage_id: string; policy: string; reason: string };
  STEP_INAPPLICABLE: { stage_id: string; step_id: string; policy: string; reason: string };
  APPROVAL_REQUIRED: { stage_id: string; step_id: string; subject: string };
  PLAYBOOK_TAINTED: { before_step: string; expected: string; observed: string };
  STEP_FAILED: { stage_id: string; step_id: string; reason: string; failure_policy: string };
}

export type DokionEvent<T extends DokionEventType = DokionEventType> = {
  schema_version: 1;
  sequence: number;
  at: string;
  run_id: string;
  actor: DokionEventActor;
  event: T;
  payload: DokionEventPayloadMap[T];
};

export type DokionEventInput<T extends DokionEventType = DokionEventType> = Omit<DokionEvent<T>, "schema_version" | "sequence">;

interface AppendLockRecord {
  token: string;
  pid: number;
  host: string;
}

async function validateEvent(root: string, event: unknown, file = EVENTS_PATH): Promise<void> {
  const issues = await validateEventData(root, event, file);
  if (issues.length > 0) {
    throw new DokionError("INVALID_EVENT", "Dokion event failed schema validation", { issues });
  }
}

async function readEventsFromDisk(root: string): Promise<DokionEvent[]> {
  const path = join(root, EVENTS_PATH);
  if (!(await Bun.file(path).exists())) return [];
  const raw = await readFile(path, "utf8");
  const events: DokionEvent[] = [];
  for (const [index, line] of raw.split("\n").filter(Boolean).entries()) {
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw new DokionError("INVALID_EVENT", "Dokion event journal contains invalid JSON", {
        line: index + 1,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
    await validateEvent(root, event, `${EVENTS_PATH}:${index + 1}`);
    events.push(event as DokionEvent);
  }
  const lastByRun = new Map<string, number>();
  for (const event of events) {
    const expected = (lastByRun.get(event.run_id) ?? 0) + 1;
    if (event.sequence !== expected) {
      throw new DokionError("INVALID_EVENT", "Dokion event sequence is not monotonic", {
        run_id: event.run_id,
        expected_sequence: expected,
        actual_sequence: event.sequence
      });
    }
    lastByRun.set(event.run_id, event.sequence);
  }
  return events;
}

function isProcessLive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    return code !== "ESRCH";
  }
}

async function withAppendLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  const path = join(root, EVENT_APPEND_LOCK_PATH);
  const record: AppendLockRecord = { token: crypto.randomUUID(), pid: process.pid, host: hostname() };
  await mkdir(dirname(path), { recursive: true });
  const deadline = Date.now() + 2_000;
  while (true) {
    try {
      await writeFile(path, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") throw error;
      let existing: AppendLockRecord | undefined;
      try {
        existing = JSON.parse(await readFile(path, "utf8")) as AppendLockRecord;
      } catch {
        existing = undefined;
      }
      if (existing && existing.host === hostname() && !isProcessLive(existing.pid)) {
        await rm(path, { force: true });
        continue;
      }
      if (Date.now() >= deadline) {
        throw new DokionError("INVALID_EVENT", "Another process is appending to the Dokion event journal", {
          path: EVENT_APPEND_LOCK_PATH
        });
      }
      await Bun.sleep(5);
    }
  }
  try {
    return await action();
  } finally {
    await rm(path, { force: true });
  }
}

export async function appendEvent<T extends DokionEventType>(root: string, input: DokionEventInput<T>): Promise<DokionEvent<T>> {
  return withAppendLock(root, async () => {
    const existing = await readEventsFromDisk(root);
    const sequence = Math.max(0, ...existing.filter((event) => event.run_id === input.run_id).map((event) => event.sequence)) + 1;
    const event: DokionEvent<T> = { schema_version: 1, sequence, ...input };
    await validateEvent(root, event);
    const path = join(root, EVENTS_PATH);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  });
}

export async function readEvents(root: string): Promise<DokionEvent[]> {
  return readEventsFromDisk(root);
}
