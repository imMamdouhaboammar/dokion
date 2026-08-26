import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertInvocationReplaySafe } from "../../src/invocation/replay-policy.ts";
import { beginSideEffect, recoverStartedSideEffects } from "../../src/state/checkpoint.ts";

const roots: string[] = [];

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "dokion-invocation-replay-"));
  roots.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((value) => rm(value, { recursive: true, force: true })));
});

describe("universal capability invocation replay policy", () => {
  test("refuses automatic replay when a command side effect recovered as STARTED_UNKNOWN", async () => {
    const project = await root();
    const started = await beginSideEffect(project, {
      runId: "run-001",
      stepId: "invoke",
      kind: "COMMAND",
      subject: "fixture-command",
      idempotencyKey: "invocation-run-001-invoke",
      parametersDigest: `sha256:${"a".repeat(64)}`
    });
    const recovered = await recoverStartedSideEffects(project, "2026-08-26T08:45:00.000Z");

    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.id).toBe(started.id);
    expect(recovered[0]?.status).toBe("STARTED_UNKNOWN");
    expect(() => assertInvocationReplaySafe(recovered[0]!)).toThrow("automatic replay");
  });
});
