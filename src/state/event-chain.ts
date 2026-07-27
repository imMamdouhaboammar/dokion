import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { validateEventData } from "../contracts/schema-validator.ts";
import { sha256 } from "../core/digest.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import type { DokionEvent, DokionEventInput, DokionEventType } from "./event-log.ts";

export const EVENT_CHAIN_HEAD_PATH = ".dokion/events.head.json";
const EVENTS_PATH = ".dokion/events.ndjson";
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

export interface EventChainHead {
  schema_version: 1;
  event_count: number;
  tail_digest: string | null;
  updated_at: string;
}

export type EventChainFailureReason =
  | "INVALID_JSON"
  | "SCHEMA_INVALID"
  | "SEQUENCE_MISMATCH"
  | "PREVIOUS_DIGEST_MISMATCH"
  | "DIGEST_MISMATCH"
  | "HEAD_MISSING"
  | "HEAD_INVALID"
  | "JOURNAL_TRUNCATED"
  | "HEAD_MISMATCH";

export interface EventChainFailure {
  reason: EventChainFailureReason;
  journal_index: number;
  run_id?: string;
  sequence?: number;
  expected_sequence?: number;
  actual_sequence?: number;
  expected_previous_digest?: string | null;
  actual_previous_digest?: string | null;
  expected_digest?: string;
  actual_digest?: string;
  expected_event_count?: number;
  actual_event_count?: number;
  detail?: string;
}

export interface EventChainVerification {
  valid: boolean;
  event_count: number;
  tail_digest: string | null;
  failure?: EventChainFailure;
}

interface EventChainInspection extends EventChainVerification {
  events: DokionEvent[];
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function calculateEventDigest(event: Omit<DokionEvent, "digest">): string {
  return sha256(canonicalize(event));
}

export function createChainedEvent<T extends DokionEventType>(
  input: DokionEventInput<T>,
  sequence: number,
  previousDigest: string | null
): DokionEvent<T> {
  const unsigned = {
    schema_version: 1 as const,
    sequence,
    ...input,
    previous_digest: previousDigest
  };
  return {
    ...unsigned,
    digest: calculateEventDigest(unsigned as Omit<DokionEvent, "digest">)
  } as DokionEvent<T>;
}

function invalid(
  events: DokionEvent[],
  tailDigest: string | null,
  failure: EventChainFailure
): EventChainInspection {
  return {
    valid: false,
    event_count: events.length,
    tail_digest: tailDigest,
    failure,
    events
  };
}

function isValidHead(value: unknown): value is EventChainHead {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const head = value as Partial<EventChainHead>;
  return head.schema_version === 1
    && Number.isInteger(head.event_count)
    && (head.event_count ?? -1) >= 0
    && (head.tail_digest === null || (typeof head.tail_digest === "string" && DIGEST_PATTERN.test(head.tail_digest)))
    && typeof head.updated_at === "string"
    && Number.isFinite(Date.parse(head.updated_at));
}

async function inspectEventChain(root: string): Promise<EventChainInspection> {
  const journalPath = join(root, EVENTS_PATH);
  const journalExists = await Bun.file(journalPath).exists();
  const raw = journalExists ? await readFile(journalPath, "utf8") : "";
  const lines = raw.split("\n").filter(Boolean);
  const events: DokionEvent[] = [];
  const lastSequenceByRun = new Map<string, number>();
  let previousDigest: string | null = null;
  let previousEvent: DokionEvent | undefined;

  for (const [offset, line] of lines.entries()) {
    const journalIndex = offset + 1;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      return invalid(events, previousDigest, {
        reason: "INVALID_JSON",
        journal_index: journalIndex,
        detail: error instanceof Error ? error.message : String(error)
      });
    }

    const issues = await validateEventData(root, value, `${EVENTS_PATH}:${journalIndex}`);
    if (issues.length > 0) {
      return invalid(events, previousDigest, {
        reason: "SCHEMA_INVALID",
        journal_index: journalIndex,
        detail: issues.map((issue) => `${issue.instancePath || "/"}: ${issue.message}`).join("; ")
      });
    }

    const event = value as DokionEvent;
    const expectedSequence = (lastSequenceByRun.get(event.run_id) ?? 0) + 1;
    const previousMismatch = event.previous_digest !== previousDigest;
    const sequenceMismatch = event.sequence !== expectedSequence;

    if (previousMismatch && previousEvent && previousEvent.run_id !== event.run_id) {
      return invalid(events, previousDigest, {
        reason: "PREVIOUS_DIGEST_MISMATCH",
        journal_index: journalIndex,
        run_id: event.run_id,
        sequence: event.sequence,
        expected_previous_digest: previousDigest,
        actual_previous_digest: event.previous_digest
      });
    }
    if (sequenceMismatch) {
      return invalid(events, previousDigest, {
        reason: "SEQUENCE_MISMATCH",
        journal_index: journalIndex,
        run_id: event.run_id,
        sequence: event.sequence,
        expected_sequence: expectedSequence,
        actual_sequence: event.sequence
      });
    }
    if (previousMismatch) {
      return invalid(events, previousDigest, {
        reason: "PREVIOUS_DIGEST_MISMATCH",
        journal_index: journalIndex,
        run_id: event.run_id,
        sequence: event.sequence,
        expected_previous_digest: previousDigest,
        actual_previous_digest: event.previous_digest
      });
    }

    const { digest, ...unsigned } = event;
    const expectedDigest = calculateEventDigest(unsigned as Omit<DokionEvent, "digest">);
    if (digest !== expectedDigest) {
      return invalid(events, previousDigest, {
        reason: "DIGEST_MISMATCH",
        journal_index: journalIndex,
        run_id: event.run_id,
        sequence: event.sequence,
        expected_digest: expectedDigest,
        actual_digest: digest
      });
    }

    events.push(event);
    lastSequenceByRun.set(event.run_id, event.sequence);
    previousDigest = event.digest;
    previousEvent = event;
  }

  const headPath = join(root, EVENT_CHAIN_HEAD_PATH);
  if (!(await Bun.file(headPath).exists())) {
    if (events.length === 0) {
      return { valid: true, event_count: 0, tail_digest: null, events };
    }
    return invalid(events, previousDigest, {
      reason: "HEAD_MISSING",
      journal_index: events.length + 1,
      actual_event_count: events.length
    });
  }

  let head: unknown;
  try {
    head = await readJson<unknown>(headPath);
  } catch (error) {
    return invalid(events, previousDigest, {
      reason: "HEAD_INVALID",
      journal_index: events.length + 1,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
  if (!isValidHead(head)) {
    return invalid(events, previousDigest, {
      reason: "HEAD_INVALID",
      journal_index: events.length + 1
    });
  }
  if (head.event_count > events.length) {
    return invalid(events, previousDigest, {
      reason: "JOURNAL_TRUNCATED",
      journal_index: events.length + 1,
      expected_event_count: head.event_count,
      actual_event_count: events.length
    });
  }
  if (head.event_count !== events.length || head.tail_digest !== previousDigest) {
    return invalid(events, previousDigest, {
      reason: "HEAD_MISMATCH",
      journal_index: events.length + 1,
      expected_event_count: head.event_count,
      actual_event_count: events.length,
      ...(head.tail_digest ? { expected_digest: head.tail_digest } : {}),
      ...(previousDigest ? { actual_digest: previousDigest } : {})
    });
  }

  return {
    valid: true,
    event_count: events.length,
    tail_digest: previousDigest,
    events
  };
}

export async function verifyEventChain(root: string): Promise<EventChainVerification> {
  const { events: _events, ...verification } = await inspectEventChain(root);
  return verification;
}

export async function readVerifiedEvents(root: string): Promise<DokionEvent[]> {
  const inspection = await inspectEventChain(root);
  if (!inspection.valid) {
    throw new DokionError("INVALID_EVENT", "Dokion event journal failed hash-chain verification", {
      ...(inspection.failure ?? {}),
      event_count: inspection.event_count,
      tail_digest: inspection.tail_digest
    });
  }
  return inspection.events;
}

export async function writeEventChainHead(root: string, events: DokionEvent[]): Promise<EventChainHead> {
  const head: EventChainHead = {
    schema_version: 1,
    event_count: events.length,
    tail_digest: events.at(-1)?.digest ?? null,
    updated_at: new Date().toISOString()
  };
  await writeJsonAtomic(join(root, EVENT_CHAIN_HEAD_PATH), head);
  return head;
}
