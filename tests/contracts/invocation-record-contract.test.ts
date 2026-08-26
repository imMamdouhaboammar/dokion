import { describe, expect, test } from "bun:test";

import {
  assertValidInvocationReceipt,
  assertValidInvocationRequest
} from "../../src/contracts/invocation-schema-validator.ts";

const DIGEST = `sha256:${"a".repeat(64)}`;

function validRequest() {
  return {
    schema: "dokion.invocation-request.v1" as const,
    invocation_id: "invocation-001",
    run_id: "run-001",
    stage_id: "stage-001",
    step_id: "step-001",
    capability: {
      type: "skill",
      id: "fixture",
      immutable_reference: DIGEST
    },
    command: {
      identity: DIGEST,
      kind: "ARGV" as const
    },
    inputs: [],
    legacy_inputs: [],
    missing_optional_inputs: [],
    expected_outputs: [{
      name: "result",
      kind: "text",
      path: ".dokion/runs/run-001/invocations/invocation-001/outputs/output-1.bin"
    }],
    created_at: "2026-08-26T09:00:00.000Z"
  };
}

describe("invocation request and receipt contracts", () => {
  test("accepts a normalized invocation request", () => {
    expect(() => assertValidInvocationRequest(validRequest())).not.toThrow();
  });

  test("rejects an empty immutable capability reference", () => {
    const request = validRequest();
    request.capability.immutable_reference = "";
    expect(() => assertValidInvocationRequest(request)).toThrow("schema validation");
  });

  test("rejects an output staging path outside the invocation-owned directory", () => {
    const request = validRequest();
    request.expected_outputs[0]!.path = "../escape.bin";
    expect(() => assertValidInvocationRequest(request)).toThrow("schema validation");
  });

  test("rejects a successful receipt that carries a failure object", () => {
    const request = validRequest();
    const receipt = {
      schema: "dokion.invocation-receipt.v1" as const,
      invocation_id: request.invocation_id,
      run_id: request.run_id,
      stage_id: request.stage_id,
      step_id: request.step_id,
      capability: request.capability,
      status: "SUCCEEDED" as const,
      command: {
        identity: DIGEST,
        kind: "ARGV" as const,
        exit_code: 0,
        started_at: "2026-08-26T09:00:00.000Z",
        ended_at: "2026-08-26T09:00:01.000Z",
        duration_ms: 1000,
        checkpoint_id: "side-effect-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        checkpoint_status: "COMPLETED" as const
      },
      inputs: [],
      outputs: [],
      failure: {
        code: "ARTIFACT_INVALID",
        message: "should not be present"
      },
      created_at: "2026-08-26T09:00:00.000Z",
      ended_at: "2026-08-26T09:00:01.000Z"
    };
    expect(() => assertValidInvocationReceipt(receipt)).toThrow("schema validation");
  });
});
