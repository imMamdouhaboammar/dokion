import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { materializeRunArtifact } from "../../src/artifacts/run-artifact-store.ts";
import { resolveStepInputs } from "../../src/artifacts/input-resolver.ts";
import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import type { DokionPlaybook, PlaybookStep } from "../../src/playbook/types.ts";

const roots: string[] = [];
const pinned = `sha256:${"a".repeat(64)}`;

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-input-resolver-"));
  roots.push(root);
  return root;
}

function consumer(required = true): PlaybookStep {
  return {
    id: "review",
    capability: { type: "skill", id: "reviewer", immutable_reference: pinned },
    responsibility: "Review the declared analysis artifact.",
    mode: "ANALYZE",
    depends_on: ["inspect"],
    inputs: [{
      name: "analysis",
      from: { step: "inspect", output: "analysis" },
      kind: "json",
      required
    }]
  };
}

function playbook(step: PlaybookStep): DokionPlaybook {
  return {
    version: "1.0.0",
    project: { name: "artifact-handoff" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY"
    },
    stages: [{
      id: "pipeline",
      execution: "SEQUENTIAL",
      steps: [
        {
          id: "inspect",
          capability: { type: "skill", id: "repo-inspector", immutable_reference: pinned },
          responsibility: "Produce analysis.",
          mode: "ANALYZE",
          outputs: [{ name: "analysis", kind: "json", media_type: "application/json" }]
        },
        step
      ]
    }]
  };
}

async function produce(root: string) {
  return materializeRunArtifact({
    root,
    runId: "run-resolve-001",
    invocationId: "invoke-inspect-001",
    stageId: "pipeline",
    stepId: "inspect",
    capability: { type: "skill", id: "repo-inspector", immutable_reference: pinned },
    declaration: { name: "analysis", kind: "json", media_type: "application/json" },
    bytes: new TextEncoder().encode("{\"score\":91}")
  });
}

async function expectCode(action: Promise<unknown>, code: DokionErrorCode) {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
  }
}

afterEach(async () => {
  while (roots.length > 0) {
    await rm(roots.pop()!, { recursive: true, force: true });
  }
});

describe("typed Playbook input resolution", () => {
  test("resolves only the declared producer output after verifying its stored bytes", async () => {
    const root = await temporaryRoot();
    const descriptor = await produce(root);
    const step = consumer();

    const resolved = await resolveStepInputs({
      root,
      runId: "run-resolve-001",
      playbook: playbook(step),
      step
    });

    expect(resolved.inputs).toHaveLength(1);
    expect(resolved.legacy_inputs).toEqual([]);
    expect(resolved.inputs[0]?.name).toBe("analysis");
    expect(resolved.inputs[0]?.kind).toBe("json");
    expect(resolved.inputs[0]?.producer).toEqual({ step: "inspect", output: "analysis" });
    expect(resolved.inputs[0]?.descriptor.digest).toBe(descriptor.digest);
    expect(resolved.inputs[0]?.blob_path).toBe(descriptor.blob_path);
  });

  test("fails closed when a required typed input was never materialized", async () => {
    const root = await temporaryRoot();
    const step = consumer(true);

    await expectCode(resolveStepInputs({
      root,
      runId: "run-resolve-001",
      playbook: playbook(step),
      step
    }), "ARTIFACT_NOT_FOUND");
  });

  test("omits only a missing optional typed input", async () => {
    const root = await temporaryRoot();
    const step = consumer(false);

    const resolved = await resolveStepInputs({
      root,
      runId: "run-resolve-001",
      playbook: playbook(step),
      step
    });

    expect(resolved.inputs).toEqual([]);
    expect(resolved.missing_optional).toEqual(["analysis"]);
  });

  test("does not downgrade integrity failure into an optional-input skip", async () => {
    const root = await temporaryRoot();
    const descriptor = await produce(root);
    const step = consumer(false);
    const blobPath = join(root, descriptor.blob_path);

    await chmod(blobPath, 0o600);
    await writeFile(blobPath, "{\"score\":19}", "utf8");
    await chmod(blobPath, 0o400);

    await expectCode(resolveStepInputs({
      root,
      runId: "run-resolve-001",
      playbook: playbook(step),
      step
    }), "ARTIFACT_DIGEST_MISMATCH");
  });

  test("keeps legacy string inputs explicit instead of pretending they are artifact bindings", async () => {
    const root = await temporaryRoot();
    await produce(root);
    const step = consumer();
    step.inputs = ["legacy-context", ...(step.inputs ?? [])];

    const resolved = await resolveStepInputs({
      root,
      runId: "run-resolve-001",
      playbook: playbook(step),
      step
    });

    expect(resolved.legacy_inputs).toEqual(["legacy-context"]);
    expect(resolved.inputs).toHaveLength(1);
  });
});
