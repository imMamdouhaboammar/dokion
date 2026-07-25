import { join } from "node:path";

import { readJson } from "../core/json.ts";
import { loadActivePlaybook } from "../playbook/load-playbook.ts";
import { evaluateCoverage, type CoverageManifest } from "../readiness/coverage.ts";
import { writeHardeningReport } from "../report/render-hardening.ts";
import { StateStore } from "../state/state-store.ts";
import type { DokionState } from "../state/types.ts";
import { ExecutionEngine as RuntimeExecutionEngine } from "./runtime-engine.ts";

export class ExecutionEngine extends RuntimeExecutionEngine {
  override async run(): Promise<DokionState> {
    const state = await super.run();
    return this.reconcileCoverage(state);
  }

  override async resume(): Promise<DokionState> {
    const state = await super.resume();
    return this.reconcileCoverage(state);
  }

  private async reconcileCoverage(state: DokionState): Promise<DokionState> {
    const loaded = await loadActivePlaybook(this.root);
    const manifestPath = loaded.data.manifest ?? "dokion.json";
    const manifest = await readJson<CoverageManifest>(join(this.root, manifestPath));
    const evaluation = evaluateCoverage({ manifest, playbook: loaded.data, state });
    const store = new StateStore(this.root);
    const updated = await store.update((current) => ({
      ...current,
      coverage: evaluation.lanes
    }));
    await writeHardeningReport(this.root, updated);
    return updated;
  }
}
