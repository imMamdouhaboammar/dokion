import { StateStore } from "../../state/state-store.ts";
import { writeHardeningReport } from "../../report/render-hardening.ts";
import { recoverAtomicWrites } from "../../core/atomic-file.ts";
import { loadActivePlaybook } from "../../playbook/load-playbook.ts";

export interface ResetCommandResult {
  reset: boolean;
  statePath: string;
  runId: string;
  status: string;
  message: string;
}

export async function handleResetCommand(root: string): Promise<ResetCommandResult> {
  await recoverAtomicWrites(root);
  const store = new StateStore(root);

  let playbookDigest = "unconfigured";
  try {
    const active = await loadActivePlaybook(root);
    playbookDigest = active.digest;
  } catch {
    // Keep unconfigured if playbook missing or unpinned
  }

  let state;
  if (await store.exists()) {
    const current = await store.load();
    state = await store.update(current.revision, (s) => ({
      ...s,
      run: {
        ...s.run,
        status: "STOPPED",
        ended_at: new Date().toISOString()
      },
      stages: s.stages.map((stage) => ({
        ...stage,
        status: "PENDING",
        steps: stage.steps.map((step) => ({
          ...step,
          status: "PENDING",
          attempts: 0,
          iterations: 0
        }))
      }))
    }));
  } else {
    state = await store.initialize({ playbookDigest, stages: [] });
    state = await store.update(state.revision, (s) => ({
      ...s,
      run: { ...s.run, status: "STOPPED", ended_at: new Date().toISOString() }
    }));
  }

  await writeHardeningReport(root, state);

  return {
    reset: true,
    statePath: ".dokion/state.json",
    runId: state.run.id,
    status: state.run.status,
    message: "Execution state reset cleanly to STOPPED status"
  };
}
