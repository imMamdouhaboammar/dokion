import { StateStore } from "../../state/state-store.ts";
import type { CliOutputFormat } from "../types.ts";

export async function handleTraceCommand(root: string, _format: CliOutputFormat): Promise<Record<string, unknown>> {
  const store = new StateStore(root);
  if (!(await store.exists())) {
    return {
      ok: false,
      command: "trace",
      error: "No state store found at .dokion/state.json"
    };
  }
  const state = await store.load();

  return {
    ok: true,
    command: "trace",
    run_id: state.run.id,
    status: state.run.status,
    started_at: state.run.started_at,
    ended_at: state.run.ended_at
  };
}
