import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import {
  beginSideEffect,
  completeSideEffect,
  recoverStartedSideEffects
} from "../../src/state/checkpoint.ts";

const roots: string[] = [];
const digest = (character: string): string => `sha256:${character.repeat(64)}`;

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "dokion-checkpoint-"));
  roots.push(value);
  return value;
}

function intent() {
  return {
    runId: "run-001",
    stepId: "scan-a",
    kind: "COMMAND" as const,
    subject: "tool-a",
    idempotencyKey: "private-idempotency-key",
    parametersDigest: digest("a"),
    startedAt: "2026-07-30T20:00:00.000Z"
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true })));
});

describe("STATE-009 side-effect checkpoints", () => {
  test("persists intent before execution with a stable id and no raw key", async () => {
    const project = await root();
    const first = await beginSideEffect(project, intent());
    const second = await beginSideEffect(project, intent());

    expect(first).toEqual(second);
    expect(first.id).toMatch(/^side-effect-[a-f0-9]{32}$/);
    expect(first).toMatchObject({ schema_version: 1, revision: 1, status: "STARTED" });
    const path = join(project, ".dokion/checkpoints/side-effects", `${first.id}.json`);
    const raw = await readFile(path, "utf8");
    expect(raw).not.toContain("private-idempotency-key");
    expect(JSON.parse(raw)).toEqual(first);
  });

  test("completes monotonically and rejects a conflicting terminal outcome", async () => {
    const project = await root();
    const started = await beginSideEffect(project, intent());
    const completed = await completeSideEffect(project, started.id, {
      status: "COMPLETED",
      at: "2026-07-30T20:01:00.000Z",
      resultDigest: digest("b"),
      evidence: [".dokion/evidence/run-001/scan-a.json"]
    });

    expect(completed).toMatchObject({
      id: started.id,
      revision: 2,
      status: "COMPLETED",
      completed_at: "2026-07-30T20:01:00.000Z",
      result_digest: digest("b")
    });
    expect(await completeSideEffect(project, started.id, {
      status: "COMPLETED",
      at: "2026-07-30T20:01:00.000Z",
      resultDigest: digest("b"),
      evidence: [".dokion/evidence/run-001/scan-a.json"]
    })).toEqual(completed);

    await expect(completeSideEffect(project, started.id, {
      status: "FAILED",
      at: "2026-07-30T20:02:00.000Z",
      errorCode: "COMMAND_FAILED"
    })).rejects.toBeInstanceOf(DokionError);
  });

  test("recovers interrupted started actions as STARTED_UNKNOWN and allows explicit completion", async () => {
    const project = await root();
    const started = await beginSideEffect(project, intent());
    const recovered = await recoverStartedSideEffects(project, "2026-07-30T20:05:00.000Z");

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      id: started.id,
      revision: 2,
      status: "STARTED_UNKNOWN",
      recovery_observed_at: "2026-07-30T20:05:00.000Z"
    });

    const completed = await completeSideEffect(project, started.id, {
      status: "COMPLETED",
      at: "2026-07-30T20:06:00.000Z",
      resultDigest: digest("c"),
      evidence: []
    });
    expect(completed).toMatchObject({ revision: 3, status: "COMPLETED" });
  });

  test("rejects unsafe subjects and non-immutable digests without writing", async () => {
    const project = await root();
    await expect(beginSideEffect(project, {
      ...intent(),
      subject: "../../outside",
      parametersDigest: "latest"
    })).rejects.toBeInstanceOf(DokionError);
    expect(await Bun.file(join(project, ".dokion/checkpoints/side-effects")).exists()).toBe(false);
  });
});
