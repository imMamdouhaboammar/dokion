import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError, type DokionErrorCode } from "../../src/core/errors.ts";
import {
  materializeRunArtifact,
  readRunArtifact
} from "../../src/artifacts/run-artifact-store.ts";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-run-artifact-"));
  roots.push(root);
  return root;
}

function options(root: string, bytes: Uint8Array) {
  return {
    root,
    runId: "run-test-001",
    invocationId: "invoke-inspect-001",
    stageId: "pipeline",
    stepId: "inspect",
    capability: {
      type: "skill",
      id: "repo-inspector",
      immutable_reference: `sha256:${"a".repeat(64)}`
    },
    declaration: {
      name: "analysis",
      kind: "json" as const,
      media_type: "application/json",
      sensitivity: "INTERNAL" as const,
      retention: "RUN" as const
    },
    bytes,
    repository: {
      commit: "abc1234",
      root_digest: `sha256:${"b".repeat(64)}`
    }
  };
}

async function expectCode(action: Promise<unknown>, code: DokionErrorCode): Promise<DokionError> {
  try {
    await action;
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(DokionError);
    expect((error as DokionError).code).toBe(code);
    return error as DokionError;
  }
}

afterEach(async () => {
  while (roots.length > 0) {
    await rm(roots.pop()!, { recursive: true, force: true });
  }
});

describe("run-scoped content-addressed artifacts", () => {
  test("materializes exact bytes with digest, size, media type, and producer provenance", async () => {
    const root = await temporaryRoot();
    const bytes = new TextEncoder().encode(JSON.stringify({ score: 91, findings: [] }));

    const descriptor = await materializeRunArtifact(options(root, bytes));

    expect(descriptor.schema).toBe("dokion.run-artifact.v1");
    expect(descriptor.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(descriptor.artifact_id).toBe(descriptor.digest);
    expect(descriptor.size_bytes).toBe(bytes.length);
    expect(descriptor.name).toBe("analysis");
    expect(descriptor.kind).toBe("json");
    expect(descriptor.media_type).toBe("application/json");
    expect(descriptor.producer.run_id).toBe("run-test-001");
    expect(descriptor.producer.invocation_id).toBe("invoke-inspect-001");
    expect(descriptor.producer.stage_id).toBe("pipeline");
    expect(descriptor.producer.step_id).toBe("inspect");
    expect(descriptor.producer.capability.id).toBe("repo-inspector");
    expect(descriptor.blob_path).toMatch(/^\.dokion\/runs\/run-test-001\/artifacts\/sha256\/[a-f0-9]{2}\/[a-f0-9]{62}\/blob$/);
    expect(descriptor.descriptor_path).toBe(".dokion/runs/run-test-001/artifacts/by-step/inspect/analysis.json");

    const loaded = await readRunArtifact({
      root,
      runId: "run-test-001",
      stepId: "inspect",
      outputName: "analysis"
    });
    expect(loaded.descriptor).toEqual(descriptor);
    expect(Buffer.from(loaded.bytes)).toEqual(Buffer.from(bytes));
  });

  test("replays the same producer output idempotently without rewriting its descriptor", async () => {
    const root = await temporaryRoot();
    const bytes = new TextEncoder().encode("{\"stable\":true}");

    const first = await materializeRunArtifact(options(root, bytes));
    const firstDescriptorBytes = await readFile(join(root, first.descriptor_path));
    const second = await materializeRunArtifact(options(root, bytes));
    const secondDescriptorBytes = await readFile(join(root, second.descriptor_path));

    expect(second).toEqual(first);
    expect(secondDescriptorBytes).toEqual(firstDescriptorBytes);
  });

  test("fails closed when the same step output is replayed with different bytes", async () => {
    const root = await temporaryRoot();
    const first = new TextEncoder().encode("{\"version\":1}");
    const changed = new TextEncoder().encode("{\"version\":2}");

    await materializeRunArtifact(options(root, first));
    const error = await expectCode(materializeRunArtifact(options(root, changed)), "ARTIFACT_CONFLICT");

    expect(error.message).toContain("already materialized with different content");
  });

  test("detects same-size blob tampering before returning bytes to a consumer", async () => {
    const root = await temporaryRoot();
    const bytes = new TextEncoder().encode("{\"trusted\":true}");
    const descriptor = await materializeRunArtifact(options(root, bytes));
    const blobPath = join(root, descriptor.blob_path);

    await chmod(blobPath, 0o600);
    await writeFile(blobPath, "{\"trusted\":fals}", "utf8");
    await chmod(blobPath, 0o400);

    await expectCode(readRunArtifact({
      root,
      runId: "run-test-001",
      stepId: "inspect",
      outputName: "analysis"
    }), "ARTIFACT_DIGEST_MISMATCH");
  });

  test("rejects a symlinked intermediate artifact directory before publishing bytes", async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, ".dokion"));
    await mkdir(join(root, "redirected-runs"));
    await symlink("../redirected-runs", join(root, ".dokion", "runs"), "dir");

    await expectCode(
      materializeRunArtifact(options(root, new TextEncoder().encode("{\"safe\":true}"))),
      "ARTIFACT_INVALID"
    );
  });

  test("rejects unsafe run and binding identifiers before filesystem access", async () => {
    const root = await temporaryRoot();
    const bytes = new TextEncoder().encode("safe");
    const unsafe = { ...options(root, bytes), runId: "../escape" };

    await expectCode(materializeRunArtifact(unsafe), "ARTIFACT_INVALID");
  });
});
