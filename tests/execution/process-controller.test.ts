import { afterEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  terminateProcessTree,
  type ProcessTreeHandle
} from "../../src/execution/process-controller.ts";

const roots: string[] = [];
const liveGroups = new Set<number>();

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-process-controller-"));
  roots.push(root);
  return root;
}

function groupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("condition did not become true before timeout");
}

afterEach(async () => {
  for (const processGroupId of liveGroups) {
    try {
      process.kill(-processGroupId, "SIGKILL");
    } catch {
      // The process group already exited.
    }
  }
  liveGroups.clear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("EXEC-005 process tree controller", () => {
  test("records graceful process-group termination without escalation", async () => {
    let alive = true;
    const signals: string[] = [];
    const handle: ProcessTreeHandle = { pid: 4100, exited: Promise.resolve(0) };

    const result = await terminateProcessTree(handle, "CANCELLATION", {
      platform: "darwin",
      gracePeriodMs: 50,
      killWaitMs: 50,
      pollIntervalMs: 1,
      killProcessGroup: (_groupId, signal) => {
        signals.push(signal);
        alive = false;
      },
      processGroupExists: () => alive
    });

    expect(result).toMatchObject({
      supported: true,
      processGroupId: 4100,
      reason: "CANCELLATION",
      signalsSent: ["SIGTERM"],
      forced: false,
      groupTerminated: true,
      exitCode: 0,
      degradations: []
    });
    expect(signals).toEqual(["SIGTERM"]);
  });

  test("escalates to SIGKILL when the process group survives the grace period", async () => {
    let alive = true;
    const signals: string[] = [];
    const handle: ProcessTreeHandle = { pid: 4200, exited: Promise.resolve(137) };

    const result = await terminateProcessTree(handle, "TIMEOUT", {
      platform: "linux",
      gracePeriodMs: 0,
      killWaitMs: 50,
      pollIntervalMs: 1,
      killProcessGroup: (_groupId, signal) => {
        signals.push(signal);
        if (signal === "SIGKILL") alive = false;
      },
      processGroupExists: () => alive
    });

    expect(result.signalsSent).toEqual(["SIGTERM", "SIGKILL"]);
    expect(result.forced).toBe(true);
    expect(result.groupTerminated).toBe(true);
    expect(result.exitCode).toBe(137);
    expect(signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  test("does not signal an already exited process group", async () => {
    const signals: string[] = [];
    const result = await terminateProcessTree(
      { pid: 4300, exited: Promise.resolve(0) },
      "POLICY_STOP",
      {
        platform: "darwin",
        killProcessGroup: (_groupId, signal) => signals.push(signal),
        processGroupExists: () => false
      }
    );

    expect(result.alreadyExited).toBe(true);
    expect(result.signalsSent).toEqual([]);
    expect(result.groupTerminated).toBe(true);
    expect(signals).toEqual([]);
  });

  test("fails closed on an unproven platform without sending signals", async () => {
    const signals: string[] = [];
    const result = await terminateProcessTree(
      { pid: 4400, exited: new Promise<number>(() => undefined) },
      "SIGNAL",
      {
        platform: "win32",
        killProcessGroup: (_groupId, signal) => signals.push(signal)
      }
    );

    expect(result).toMatchObject({
      supported: false,
      platform: "win32",
      groupTerminated: false,
      signalsSent: [],
      degradations: ["UNPROVEN_PROCESS_TREE_TERMINATION"]
    });
    expect(signals).toEqual([]);
  });

  test.skipIf(!["darwin", "linux"].includes(process.platform))(
    "terminates a detached parent and its descendant",
    async () => {
      const root = await fixtureRoot();
      const pidFile = join(root, "pids.json");
      const script = join(root, "tree.ts");
      await writeFile(script, `
process.on("SIGTERM", () => {});
const child = Bun.spawn([
  process.execPath,
  "-e",
  "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
await Bun.write(${JSON.stringify(pidFile)}, JSON.stringify({ parent: process.pid, child: child.pid }));
setInterval(() => {}, 1000);
`);

      const parent = spawn(process.execPath, ["run", script], {
        detached: true,
        stdio: "ignore"
      });
      if (!parent.pid) throw new Error("detached parent did not expose a pid");
      liveGroups.add(parent.pid);

      const exited = new Promise<number>((resolve) => {
        parent.once("exit", (code, signal) => {
          resolve(code ?? (signal === "SIGKILL" ? 137 : 143));
        });
      });

      const deadline = Date.now() + 1500;
      while (!(await Bun.file(pidFile).exists())) {
        if (Date.now() >= deadline) throw new Error("process tree did not publish its pids");
        await Bun.sleep(10);
      }
      const pids = JSON.parse(await readFile(pidFile, "utf8")) as { parent: number; child: number };
      expect(pids.parent).toBe(parent.pid);
      expect(groupExists(parent.pid)).toBe(true);

      const result = await terminateProcessTree({ pid: parent.pid, exited }, "TIMEOUT", {
        platform: process.platform,
        gracePeriodMs: 25,
        killWaitMs: 1000,
        pollIntervalMs: 10
      });
      liveGroups.delete(parent.pid);

      expect(result.signalsSent).toEqual(["SIGTERM", "SIGKILL"]);
      expect(result.forced).toBe(true);
      expect(result.groupTerminated).toBe(true);
      await waitUntil(() => !groupExists(parent.pid!));
      await waitUntil(() => {
        try {
          process.kill(pids.child, 0);
          return false;
        } catch (error) {
          return error instanceof Error && "code" in error && error.code === "ESRCH";
        }
      });
    }
  );
});
