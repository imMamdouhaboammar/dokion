import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PlaybookStage, PlaybookStep } from "../../src/playbook/types.ts";
import { executeStepVerification } from "../../src/verification/step-verification.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("step verification policy", () => {
  test("refuses a verification command outside permissions.shell without executing it", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-step-verify-policy-"));
    roots.push(root);
    const command = "printf unsafe > unauthorized-marker";
    const stage: PlaybookStage = {
      id: "verification",
      execution: "SEQUENTIAL",
      steps: []
    };
    const step: PlaybookStep = {
      id: "policy-check",
      capability: {
        type: "command",
        id: "policy-check",
        immutable_reference: `sha256:${"a".repeat(64)}`
      },
      responsibility: "Prove verification permission enforcement.",
      mode: "VERIFY_ONLY",
      verification: [command],
      permissions: {
        read: ["**/*"],
        write: [],
        network: false,
        shell: []
      }
    };
    stage.steps.push(step);

    const result = await executeStepVerification({
      root,
      stage,
      step,
      runId: "run-policy",
      evidenceRoot: ".dokion/evidence/run-policy/verify/policy-check",
      stopOnFailure: false
    });

    expect(result.passed).toBe(false);
    expect(result.reason).toBe("Verification command is outside permissions.shell");
    expect(result.executions).toHaveLength(0);
    expect(result.evidence).toHaveLength(0);
    expect(await Bun.file(join(root, "unauthorized-marker")).exists()).toBe(false);
  });
});
