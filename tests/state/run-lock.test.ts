import { afterEach, describe, expect, test } from "bun:test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { ExecutionEngine } from "../../src/engine/execution-engine.ts";
import {
  RUN_LOCK_PATH,
  RUN_LOCK_RECOVERY_LOG_PATH,
  acquireRunLock,
  recoverStaleRunLock,
  type RunLockRecord
} from "../../src/state/run-lock.ts";

const temporaryRoots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-run-lock-"));
  temporaryRoots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  return root;
}

async function writeStaleLock(root: string): Promise<RunLockRecord> {
  const record: RunLockRecord = {
    schema_version: 1,
    owner_token: "stale-owner",
    run_id: "run-stale",
    operation: "resume",
    acquired_at: "2026-07-27T00:00:00.000Z",
    process: {
      pid: 2_147_483_647,
      host: hostname()
    },
    recovery: {
      status: "ACTIVE",
      archive_directory: ".dokion/recovery/run-locks"
    }
  };
  await writeFile(join(root, RUN_LOCK_PATH), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("exclusive project run locking", () => {
  test("blocks a second live process until the owning lease releases", async () => {
    const root = await createRoot();
    const first = await acquireRunLock(root, { runId: "run-1", operation: "run" });

    expect(first.record.run_id).toBe("run-1");
    expect(first.record.process.pid).toBe(process.pid);
    expect(first.record.process.host).toBe(hostname());
    expect(first.record.recovery.status).toBe("ACTIVE");

    await expect(acquireRunLock(root, { runId: "run-2", operation: "resume" })).rejects.toMatchObject({
      code: "RUN_LOCKED",
      details: { run_id: "run-1", operation: "run" }
    });

    await first.release();
    await expect(access(join(root, RUN_LOCK_PATH))).rejects.toBeDefined();

    const second = await acquireRunLock(root, { runId: "run-2", operation: "resume" });
    await second.release();
  });

  test("does not overwrite a stale lock without an explicit recorded recovery", async () => {
    const root = await createRoot();
    const stale = await writeStaleLock(root);

    await expect(acquireRunLock(root, { runId: "run-new", operation: "run" })).rejects.toMatchObject({
      code: "RUN_LOCK_STALE",
      details: { run_id: stale.run_id, owner_token: stale.owner_token }
    });

    expect(JSON.parse(await readFile(join(root, RUN_LOCK_PATH), "utf8"))).toEqual(stale);

    const recovery = await recoverStaleRunLock(root, {
      by: "operator@example.com",
      reason: "Confirmed the recorded process no longer exists"
    });

    expect(recovery.previous_owner_token).toBe(stale.owner_token);
    expect(recovery.by).toBe("operator@example.com");
    expect(recovery.reason).toContain("no longer exists");
    await access(join(root, recovery.archive_path));

    const logLines = (await readFile(join(root, RUN_LOCK_RECOVERY_LOG_PATH), "utf8")).trim().split("\n");
    expect(logLines).toHaveLength(1);
    expect(JSON.parse(logLines[0]!)).toMatchObject({
      previous_owner_token: stale.owner_token,
      previous_run_id: stale.run_id,
      by: "operator@example.com"
    });

    const lease = await acquireRunLock(root, { runId: "run-new", operation: "run" });
    await lease.release();
  });

  test("guards run and resume before playbook loading or state mutation", async () => {
    const root = await createRoot();
    const lease = await acquireRunLock(root, { runId: "run-owner", operation: "run" });

    await expect(new ExecutionEngine(root).run()).rejects.toMatchObject({
      code: "RUN_LOCKED",
      details: { run_id: "run-owner" }
    });
    await expect(new ExecutionEngine(root).resume()).rejects.toMatchObject({
      code: "RUN_LOCKED",
      details: { run_id: "run-owner" }
    });

    await lease.release();
  });

  test("guards the verify CLI operation before validation", async () => {
    const root = await createRoot();
    const lease = await acquireRunLock(root, { runId: "run-owner", operation: "run" });
    const cliPath = join(process.cwd(), "src/cli.ts");
    const child = Bun.spawn([process.execPath, "run", cliPath, "verify", "--format", "json"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore"
    });
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      child.stderr ? new Response(child.stderr).text() : ""
    ]);

    expect(exitCode).toBe(1);
    expect(JSON.parse(stderr)).toMatchObject({
      error: "RUN_LOCKED",
      details: { run_id: "run-owner", operation: "run" }
    });

    await lease.release();
  });

  test("rejects tampered lock metadata instead of archiving outside the project", async () => {
    const root = await createRoot();
    const tampered = await writeStaleLock(root);
    const escapeName = `${basename(root)}-outside`;
    const escapePath = join(root, "..", escapeName);
    temporaryRoots.push(escapePath);
    await writeFile(join(root, RUN_LOCK_PATH), `${JSON.stringify({
      ...tampered,
      operation: "deploy",
      recovery: { ...tampered.recovery, archive_directory: `../${escapeName}` }
    }, null, 2)}
`);

    await expect(recoverStaleRunLock(root, {
      by: "operator",
      reason: "attempt recovery"
    })).rejects.toMatchObject({ code: "INVALID_RUN_LOCK" });

    await access(join(root, RUN_LOCK_PATH));
    await expect(access(escapePath)).rejects.toBeDefined();
    await expect(access(join(root, RUN_LOCK_RECOVERY_LOG_PATH))).rejects.toBeDefined();
  });

  test("refuses stale recovery while the recorded process is still live", async () => {
    const root = await createRoot();
    const lease = await acquireRunLock(root, { runId: "run-live", operation: "verify" });

    await expect(recoverStaleRunLock(root, { by: "operator", reason: "forced takeover" })).rejects.toMatchObject({
      code: "RUN_LOCKED",
      details: { run_id: "run-live", operation: "verify" }
    });

    await lease.release();
  });
});
