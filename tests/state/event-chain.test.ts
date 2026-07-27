import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EVENT_CHAIN_HEAD_PATH, verifyEventChain } from "../../src/state/event-chain.ts";
import { appendEvent, EVENTS_PATH } from "../../src/state/event-log.ts";

const roots: string[] = [];
const actor = { type: "runtime" as const, id: "dokion-runtime" };

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-event-chain-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  return root;
}

async function appendFixtureEvents(root: string, runId = "run-a"): Promise<void> {
  await appendEvent(root, {
    at: "2026-07-27T16:10:00.000Z",
    run_id: runId,
    actor,
    event: "RUN_RESUMED",
    payload: {}
  });
  await appendEvent(root, {
    at: "2026-07-27T16:10:01.000Z",
    run_id: runId,
    actor,
    event: "STEP_STARTED",
    payload: { stage_id: "stage-1", step_id: "step-1" }
  });
  await appendEvent(root, {
    at: "2026-07-27T16:10:02.000Z",
    run_id: runId,
    actor,
    event: "STEP_SUCCEEDED",
    payload: { stage_id: "stage-1", step_id: "step-1" }
  });
}

async function readLines(root: string): Promise<string[]> {
  return (await readFile(join(root, EVENTS_PATH), "utf8")).trim().split("\n");
}

async function writeLines(root: string, lines: string[]): Promise<void> {
  await writeFile(join(root, EVENTS_PATH), `${lines.join("\n")}\n`);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("event journal hash chain", () => {
  test("verifies an intact journal and durable tail head", async () => {
    const root = await createRoot();
    await appendFixtureEvents(root);

    const verification = await verifyEventChain(root);
    expect(verification).toMatchObject({
      valid: true,
      event_count: 3,
      tail_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/)
    });
    const head = JSON.parse(await readFile(join(root, EVENT_CHAIN_HEAD_PATH), "utf8"));
    expect(head).toMatchObject({
      schema_version: 1,
      event_count: 3,
      tail_digest: verification.tail_digest
    });
  });

  test("identifies the first modified event without rewriting evidence", async () => {
    const root = await createRoot();
    await appendFixtureEvents(root);
    const lines = await readLines(root);
    const modified = JSON.parse(lines[1]!);
    modified.payload.step_id = "step-tampered";
    lines[1] = JSON.stringify(modified);
    await writeLines(root, lines);
    const before = await readFile(join(root, EVENTS_PATH), "utf8");

    expect(await verifyEventChain(root)).toMatchObject({
      valid: false,
      failure: { reason: "DIGEST_MISMATCH", journal_index: 2, run_id: "run-a", sequence: 2 }
    });
    expect(await readFile(join(root, EVENTS_PATH), "utf8")).toBe(before);
  });

  test("detects deletion and insertion at the first broken link", async () => {
    const deletionRoot = await createRoot();
    await appendFixtureEvents(deletionRoot);
    const deleted = await readLines(deletionRoot);
    deleted.splice(1, 1);
    await writeLines(deletionRoot, deleted);
    expect(await verifyEventChain(deletionRoot)).toMatchObject({
      valid: false,
      failure: { reason: "SEQUENCE_MISMATCH", journal_index: 2, expected_sequence: 2, actual_sequence: 3 }
    });

    const insertionRoot = await createRoot();
    await appendFixtureEvents(insertionRoot);
    const inserted = await readLines(insertionRoot);
    inserted.splice(1, 0, inserted[0]!);
    await writeLines(insertionRoot, inserted);
    expect(await verifyEventChain(insertionRoot)).toMatchObject({
      valid: false,
      failure: { reason: "SEQUENCE_MISMATCH", journal_index: 2, expected_sequence: 2, actual_sequence: 1 }
    });
  });

  test("detects tail truncation against the durable head", async () => {
    const root = await createRoot();
    await appendFixtureEvents(root);
    const lines = await readLines(root);
    await writeLines(root, lines.slice(0, -1));

    expect(await verifyEventChain(root)).toMatchObject({
      valid: false,
      failure: { reason: "JOURNAL_TRUNCATED", journal_index: 3, expected_event_count: 3, actual_event_count: 2 }
    });
  });

  test("detects cross-run splicing through the global previous digest", async () => {
    const rootA = await createRoot();
    const rootB = await createRoot();
    await appendFixtureEvents(rootA, "run-a");
    await appendFixtureEvents(rootB, "run-b");
    const linesA = await readLines(rootA);
    const linesB = await readLines(rootB);
    linesA.splice(1, 0, linesB[1]!);
    await writeLines(rootA, linesA);

    expect(await verifyEventChain(rootA)).toMatchObject({
      valid: false,
      failure: { reason: "PREVIOUS_DIGEST_MISMATCH", journal_index: 2, run_id: "run-b", sequence: 2 }
    });
  });
});
