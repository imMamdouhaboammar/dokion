import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAnalyzeCapability } from "../../src/engine/capability-runner.ts";
import type { LoadedPlaybook, PlaybookStage, PlaybookStep } from "../../src/playbook/types.ts";
import type { DokionState } from "../../src/state/types.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("native scanner engine preflight", () => {
  test("rejects an unsafe declared report path before the scanner command can run", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-scanner-preflight-"));
    roots.push(root);
    const marker = join(root, "executed.marker");
    const command = [
      "bun -e",
      JSON.stringify("require('node:fs').writeFileSync('executed.marker','yes')"),
      "-- --report-path ../outside.json",
    ].join(" ");
    const step = {
      id: "secret-scan",
      capability: {
        type: "tool",
        id: "gitleaks",
        immutable_reference: `sha256:${"a".repeat(64)}`,
      },
      responsibility: "Scan for secrets",
      mode: "ANALYZE",
      permissions: {
        read: ["**/*"],
        write: [".dokion/**"],
        network: false,
        shell: [command],
      },
      verification: [],
    } satisfies PlaybookStep;

    await expect(runAnalyzeCapability({
      root,
      loaded: { data: { defaults: {} } } as LoadedPlaybook,
      state: {
        run: { id: "run-preflight" },
      } as DokionState,
      stage: { id: "security", execution: "SEQUENTIAL", steps: [step] } satisfies PlaybookStage,
      step,
    })).rejects.toThrow("repository path policy");

    expect(await Bun.file(marker).exists()).toBe(false);
  });
});
