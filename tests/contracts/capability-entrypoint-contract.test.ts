import { describe, expect, test } from "bun:test";

import { validatePlaybookData } from "../../src/contracts/schema-validator.ts";

const pinned = `sha256:${"a".repeat(64)}`;

function playbook() {
  const command = {
    executable: "bun",
    args: ["run", "tools/produce.ts"]
  };

  return {
    version: "1.0.0",
    project: { name: "universal-invocation" },
    authority: {
      capability_selection: "USER_ONLY",
      execution_order: "USER_ONLY"
    },
    stages: [{
      id: "pipeline",
      execution: "SEQUENTIAL",
      steps: [{
        id: "produce",
        capability: {
          type: "command",
          id: "producer",
          immutable_reference: pinned,
          entrypoint: {
            kind: "command",
            command
          }
        },
        responsibility: "Produce the declared JSON artifact.",
        mode: "READ_ONLY",
        outputs: [{
          name: "result",
          kind: "json",
          media_type: "application/json"
        }],
        permissions: {
          shell: [command]
        }
      }]
    }]
  };
}

describe("explicit capability entrypoint contract", () => {
  test("accepts an argv command entrypoint only as an explicit Playbook declaration and grant", async () => {
    const issues = await validatePlaybookData(process.cwd(), playbook());
    expect(issues).toEqual([]);
  });
});
