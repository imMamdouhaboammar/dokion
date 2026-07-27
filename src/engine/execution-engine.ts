import { join } from "node:path";

import { readJson } from "../core/json.ts";
import { listFindings } from "../findings/finding-store.ts";
import { loadActivePlaybook } from "../playbook/load-playbook.ts";
import { evaluateCoverage, type CoverageManifest } from "../readiness/coverage.ts";
import { evaluateReleaseGates } from "../readiness/release-gates.ts";
import { writeHardeningReport } from "../report/render-hardening.ts";
import { acquireRunLock } from "../state/run-lock.ts";
import { createRunId, StateStore } from "../state/state-store.ts";
import type { DokionState } from "../state/types.ts";
import { ExecutionEngine as RuntimeExecutionEngine } from "./runtime-engine.ts";

export class ExecutionEngine extends RuntimeExecutionEngine {
  override async run(): Promise<DokionState> {
    const runId = createRunId();
    const lease = await acquireRunLock(this.root, { runId, operation: "run" });
    try {
      const state = await this.startRun(runId);
      return this.reconcileState(state);
    } finally {
      await lease.release();
    }
  }

  override async resume(): Promise<DokionState> {
    const fallbackRunId = createRunId();
    const runId = (await this.store.exists()) ? (await this.store.load()).run.id : fallbackRunId;
    const lease = await acquireRunLock(this.root, { runId, operation: "resume" });
    try {
      const state = await this.continueRun(fallbackRunId);
      return this.reconcileState(state);
    } finally {
      await lease.release();
    }
  }

  private async reconcileState(state: DokionState): Promise<DokionState> {
    const loaded = await loadActivePlaybook(this.root);
    const manifestPath = loaded.data.manifest ?? "dokion.json";
    const manifest = await readJson<CoverageManifest>(join(this.root, manifestPath));
    const evaluation = evaluateCoverage({ manifest, playbook: loaded.data, state });
    const findings = await listFindings(this.root);
    const releaseGates = await evaluateReleaseGates({
      root: this.root,
      playbook: loaded.data,
      state,
      findings
    });

    const store = new StateStore(this.root);
    const updated = await store.update(state.revision, (current) => ({
      ...current,
      coverage: evaluation.lanes,
      release_gates: releaseGates
    }));
    await writeHardeningReport(this.root, updated);
    return updated;
  }
}
