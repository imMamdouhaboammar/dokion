import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { STATE_TRANSITION_LOCK_PATH, StateStore } from "../../src/state/state-store.ts";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-state-revision-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await mkdir(join(root, "schemas"), { recursive: true });
  await Bun.write(join(root, "schemas/dokion-state.schema.json"), Bun.file(join(process.cwd(), "schemas/dokion-state.schema.json")));
  return root;
}

function initialization() {
  return {
    playbookDigest: `sha256:${"a".repeat(64)}`,
    commitSha: "abcdef1",
    stages: [{ id: "runtime", steps: [{ id: "step-1", mode: "VERIFY_ONLY" }] }]
  };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("monotonic state revisions", () => {
  test("starts at zero and increments exactly once for every accepted update", async () => {
    const root = await createRoot();
    const store = new StateStore(root);
    const initial = await store.initialize(initialization());

    expect(initial.revision).toBe(0);

    const first = await store.update(initial.revision, (state) => ({
      ...state,
      revision: 999,
      run: { ...state.run, status: "STOPPED", ended_at: new Date().toISOString() }
    }));

    expect(first.revision).toBe(1);
    expect((await store.load()).revision).toBe(1);
  });

  test("rejects a stale writer without changing the newer state", async () => {
    const root = await createRoot();
    const store = new StateStore(root);
    const initial = await store.initialize(initialization());
    const current = await store.update(initial.revision, (state) => ({
      ...state,
      run: { ...state.run, status: "STOPPED", ended_at: new Date().toISOString() }
    }));

    await expect(store.update(initial.revision, (state) => ({
      ...state,
      run: { ...state.run, status: "FAILED", ended_at: new Date().toISOString() }
    }))).rejects.toMatchObject({
      code: "STATE_REVISION_CONFLICT",
      details: { expected_revision: 0, actual_revision: 1 }
    });

    const persisted = await store.load();
    expect(persisted.revision).toBe(current.revision);
    expect(persisted.run.status).toBe("STOPPED");
  });

  test("allows only one concurrent writer to claim the same revision", async () => {
    const root = await createRoot();
    const storeA = new StateStore(root);
    const storeB = new StateStore(root);
    const initial = await storeA.initialize(initialization());

    const results = await Promise.allSettled([
      storeA.update(initial.revision, async (state) => {
        await Bun.sleep(25);
        return { ...state, run: { ...state.run, status: "STOPPED", ended_at: new Date().toISOString() } };
      }),
      storeB.update(initial.revision, (state) => ({
        ...state,
        run: { ...state.run, status: "FAILED", ended_at: new Date().toISOString() }
      }))
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: {
        code: "STATE_REVISION_CONFLICT",
        details: { expected_revision: 0, actual_revision: 1 }
      }
    });
    expect((await storeA.load()).revision).toBe(1);
  });

  test("does not write state or remove a lock after transition ownership is lost", async () => {
    const root = await createRoot();
    const store = new StateStore(root);
    const initial = await store.initialize(initialization());
    const foreignLock = {
      owner_token: "foreign-owner",
      pid: process.pid,
      host: "foreign-host",
      acquired_at: new Date().toISOString()
    };

    await expect(store.update(initial.revision, async (state) => {
      await writeFile(join(root, STATE_TRANSITION_LOCK_PATH), `${JSON.stringify(foreignLock)}
`);
      return { ...state, run: { ...state.run, status: "FAILED", ended_at: new Date().toISOString() } };
    })).rejects.toMatchObject({ code: "STATE_WRITE_LOCKED" });

    expect((await store.load()).revision).toBe(0);
    expect((await store.load()).run.status).toBe("RUNNING");
    expect(JSON.parse(await readFile(join(root, STATE_TRANSITION_LOCK_PATH), "utf8"))).toEqual(foreignLock);
  });

  test("requires the current revision before replacing an existing run state", async () => {
    const root = await createRoot();
    const store = new StateStore(root);
    const initial = await store.initialize(initialization());

    await expect(store.initialize(initialization())).rejects.toMatchObject({
      code: "STATE_REVISION_CONFLICT",
      details: { actual_revision: 0 }
    });

    const replacement = await store.initialize(initialization(), initial.revision);
    expect(replacement.revision).toBe(1);
    expect(replacement.run.id).not.toBe(initial.run.id);
  });

  test("rejects persisted state that omits the revision", async () => {
    const root = await createRoot();
    const store = new StateStore(root);
    const initial = await store.initialize(initialization());
    const path = join(root, ".dokion/state.json");
    const raw = JSON.parse(await readFile(path, "utf8"));
    delete raw.revision;
    await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`);

    await expect(store.load()).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(initial.revision).toBe(0);
  });
});
