import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { dirname, join } from "node:path";

import { validateStateData } from "../contracts/schema-validator.ts";
import { DokionError } from "../core/errors.ts";
import { readJson, writeJsonAtomic } from "../core/json.ts";
import { captureRepositoryIdentity } from "../git/repository-identity.ts";
import { detectAgentPlatform } from "../platform/platform-detector.ts";
import type { DokionState, StateInitialization } from "./types.ts";

export const STATE_PATH = ".dokion/state.json";
export const STATE_TRANSITION_LOCK_PATH = ".dokion/state.transition.lock";

interface StateTransitionLockRecord {
  owner_token: string;
  pid: number;
  host: string;
  acquired_at: string;
}

export function createRunId(): string {
  return `run-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

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

  async initialize(input: StateInitialization, expectedRevision?: number): Promise<DokionState> {
    return this.withTransitionLock(async (assertOwnership) => {
      const current = (await this.exists()) ? await this.load() : undefined;
      if (current) {
        this.assertExpectedRevision(expectedRevision, current.revision);
      } else if (expectedRevision !== undefined) {
        throw new DokionError("STATE_REVISION_CONFLICT", "Cannot replace missing Dokion state", {
          expected_revision: expectedRevision,
          actual_revision: null
        });
      }

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
      const repositoryIdentity = input.repositoryIdentity ?? await captureRepositoryIdentity(this.root, input.playbookDigest);

      const state: DokionState = {
        $schema: "../schemas/dokion-state.schema.json",
        schema_version: 1,
        revision: current ? current.revision + 1 : 0,
        run: {
          id: input.runId ?? createRunId(),
          started_at: now,
          status: "RUNNING",
          agent: platform.agent,
          ...(platform.version ? { agent_version: platform.version } : {}),
          ...(platform.model ? { model: platform.model } : {}),
          degradations: platform.degradations
        },
        repository_identity: repositoryIdentity,
        ...(baseline ? { baseline } : {}),
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

      await assertOwnership();
      await this.writeValidated(state);
      return state;
    });
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

  async update(
    expectedRevision: number,
    mutator: (state: DokionState) => DokionState | Promise<DokionState>
  ): Promise<DokionState> {
    return this.withTransitionLock(async (assertOwnership) => {
      const current = await this.load();
      this.assertExpectedRevision(expectedRevision, current.revision);
      const proposed = await mutator(structuredClone(current));
      const next: DokionState = { ...proposed, revision: current.revision + 1 };
      await assertOwnership();
      await this.writeValidated(next);
      return next;
    });
  }

  private async withTransitionLock<T>(
    action: (assertOwnership: () => Promise<void>) => Promise<T>
  ): Promise<T> {
    const lockPath = join(this.root, STATE_TRANSITION_LOCK_PATH);
    const record: StateTransitionLockRecord = {
      owner_token: crypto.randomUUID(),
      pid: process.pid,
      host: hostname(),
      acquired_at: new Date().toISOString()
    };
    await mkdir(dirname(lockPath), { recursive: true });

    const deadline = Date.now() + 2_000;
    while (true) {
      try {
        await writeFile(lockPath, `${JSON.stringify(record)}
`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        break;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (code !== "EEXIST") throw error;
        const existing = await this.readTransitionLock(lockPath);
        if (existing && existing.host === hostname() && !this.isProcessLive(existing.pid)) {
          await rm(lockPath, { force: true });
          continue;
        }
        if (Date.now() >= deadline) {
          throw new DokionError("STATE_WRITE_LOCKED", "Another process is applying a Dokion state transition", {
            path: STATE_TRANSITION_LOCK_PATH,
            ...(existing ? { pid: existing.pid, host: existing.host, acquired_at: existing.acquired_at } : {})
          });
        }
        await Bun.sleep(5);
      }
    }

    const assertOwnership = async (): Promise<void> => {
      const current = await this.readTransitionLock(lockPath);
      if (current?.owner_token === record.owner_token) return;
      throw new DokionError("STATE_WRITE_LOCKED", "Dokion lost ownership of the state transition lock", {
        path: STATE_TRANSITION_LOCK_PATH,
        expected_owner_token: record.owner_token,
        actual_owner_token: current?.owner_token ?? null
      });
    };

    try {
      const result = await action(assertOwnership);
      await assertOwnership();
      return result;
    } finally {
      const current = await this.readTransitionLock(lockPath);
      if (current?.owner_token === record.owner_token) {
        await rm(lockPath, { force: true });
      }
    }
  }

  private async readTransitionLock(path: string): Promise<StateTransitionLockRecord | undefined> {
    try {
      const value = JSON.parse(await readFile(path, "utf8")) as Partial<StateTransitionLockRecord>;
      if (typeof value.owner_token !== "string" || typeof value.pid !== "number" || typeof value.host !== "string" || typeof value.acquired_at !== "string") {
        return undefined;
      }
      return value as StateTransitionLockRecord;
    } catch {
      return undefined;
    }
  }

  private isProcessLive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      return code !== "ESRCH";
    }
  }

  private assertExpectedRevision(expectedRevision: number | undefined, actualRevision: number): void {
    if (expectedRevision === actualRevision) return;
    throw new DokionError("STATE_REVISION_CONFLICT", "Dokion state changed before this transition could be applied", {
      expected_revision: expectedRevision ?? null,
      actual_revision: actualRevision
    });
  }

  private async writeValidated(state: DokionState): Promise<void> {
    const issues = await validateStateData(this.root, state, STATE_PATH);
    if (issues.length > 0) {
      throw new DokionError("INVALID_STATE", "Refusing to persist invalid Dokion state", { issues });
    }
    await writeJsonAtomic(this.path, state);
  }
}
