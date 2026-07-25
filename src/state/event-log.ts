import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const EVENTS_PATH = ".dokion/events.ndjson";

export interface DokionEvent {
  at: string;
  run_id: string;
  event: string;
  stage_id?: string;
  step_id?: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export async function appendEvent(root: string, event: DokionEvent): Promise<void> {
  const path = join(root, EVENTS_PATH);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, "utf8");
}

export async function readEvents(root: string): Promise<DokionEvent[]> {
  const path = join(root, EVENTS_PATH);
  if (!(await Bun.file(path).exists())) {
    return [];
  }
  const raw = await readFile(path, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DokionEvent);
}
