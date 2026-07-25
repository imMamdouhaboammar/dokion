import { join } from "node:path";

import { validateStateData } from "../contracts/schema-validator.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import { detectAgentPlatform } from "../platform/platform-detector.ts";
import type { DokionState, StateInitialization } from "./types.ts";

export const STATE_PATH = ".dokion/state.json";

export class StateStore {
  readonly root: string;
  readonly path: string;

  constructor(root: string) {
    this.root = root;
    this.path = join(root, STATE_PATH);
  }

  async exists(): Promise<boolean> {
    return Bun.file(this.path).exists();
  }

  async initialize(input: StateInitialization): Promise<DokionState> {
    const now = new Date().toISOString();
    const baseline = input.commitSha || input.branch || input.worktreeClean !== undefined
      ? {
          ...(input.commitSha ? { commit: input.commitSha } : {}),
          ...(input.branch ? { branch: input.branch } : {}),
          ...(input.worktreeClean !== undefined ? { worktree_clean: input.worktreeClean } : {}),
          captured_at: now
        }
      : undefined;
    const platform = input.platform ?? detectAgentPlatform();

    const state: DokionState = {
      $schema: "../schemas/dokion-state.schema.json",
      schema_version: 1,
      run: {
        id: `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        started_at: now,
        status: "RUNNING",
        agent: platform.agent,
        ...(platform.version ? { agent_version: platform.version } : {}),
        ...(platform.model ? { model: platform.model } : {}),
        degradations: platform.degradations
      },
      playbook: {
        path: ".dokion/playbook.json",
        digest_algorithm: "sha256",
        digest: input.playbookDigest,
        verified_at: now
      },
      ...(input.profile ? { profile: structuredClone(input.profile) } : { profile: { platform } }),
      stages: input.stages.map((stage) => ({
        id: stage.id,
        status: "PENDING",
        steps: stage.steps.map((step) => ({
          id: step.id,
          status: "PENDING",
          ...(step.mode ? { mode: step.mode } : {}),
          attempts: 0,
          iterations: 0,
          verification_results: [],
          evidence: []
        }))
      })),
      approvals: [],
      release_gates: [],
      suggestions: [],
      log: [],
      events_log: ".dokion/events.ndjson"
    };

    await this.writeValidated(state);
    return state;
  }

  async load(): Promise<DokionState> {
    if (!(await this.exists())) {
      throw new DokionError("STATE_NOT_FOUND", `No Dokion state exists at ${STATE_PATH}`, { path: STATE_PATH });
    }
    const state = await readJson<DokionState>(this.path);
    const issues = await validateStateData(this.root, state, STATE_PATH);
    if (issues.length > 0) {
      throw new DokionError("INVALID_STATE", "Dokion state failed schema validation", { issues });
    }
    return state;
  }

  async update(mutator: (state: DokionState) => DokionState | Promise<DokionState>): Promise<DokionState> {
    const current = await this.load();
    const next = await mutator(structuredClone(current));
    await this.writeValidated(next);
    return next;
  }

  private async writeValidated(state: DokionState): Promise<void> {
    const issues = await validateStateData(this.root, state, STATE_PATH);
    if (issues.length > 0) {
      throw new DokionError("INVALID_STATE", "Refusing to persist invalid Dokion state", { issues });
    }
    await writeJsonAtomic(this.path, state);
  }
}
