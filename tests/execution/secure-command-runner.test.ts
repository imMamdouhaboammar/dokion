import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DokionError } from "../../src/core/errors.ts";
import { runCommand } from "../../src/engine/command-runner.ts";

const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-secure-runner-"));
  roots.push(root);
  return root;
}

function pidExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("secure command runner integration", () => {
  test("executes argv commands without shell interpretation", async () => {
    const root = await fixtureRoot();
    const result = await runCommand(root, {
      executable: "/bin/echo",
      args: ["$(printf injected)"]
    }, {
      artifactPrefix: ".dokion/evidence/test-argv",
      timeoutSeconds: 2
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("$(printf injected)");
    expect(result.commandKind).toBe("ARGV");
    expect(result.shellParsing).toBe(false);
    expect(result.degradations).toEqual([]);
    expect(await readFile(join(root, result.stdoutArtifact.artifactPath), "utf8"))
      .toBe("$(printf injected)\n");
  });

  test("preserves legacy string callers with explicit shell-risk evidence", async () => {
    const root = await fixtureRoot();
    const result = await runCommand(root, "printf 'legacy-output'", {
      artifactPrefix: ".dokion/evidence/test-legacy",
      timeoutSeconds: 2
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("legacy-output");
    expect(result.commandKind).toBe("SHELL");
    expect(result.shellParsing).toBe(true);
    expect(result.degradations).toContain("LEGACY_SHELL_COMMAND");
  });

  test("restricts the child environment and redacts declared values from evidence", async () => {
    const root = await fixtureRoot();
    const secret = "runner-secret-value";
    const code = `console.log(JSON.stringify({
      safe: process.env.SAFE_TOKEN,
      home: process.env.HOME ?? null,
      aws: process.env.AWS_SECRET_ACCESS_KEY ?? null,
      loader: process.env.LD_PRELOAD ?? null
    }))`;

    const result = await runCommand(root, {
      executable: process.execPath,
      args: ["-e", code]
    }, {
      artifactPrefix: ".dokion/evidence/test-env",
      timeoutSeconds: 2,
      env: { SAFE_TOKEN: secret },
      parentEnvironment: {
        PATH: process.env.PATH,
        HOME: "/Users/private-home",
        AWS_SECRET_ACCESS_KEY: "undeclared-secret",
        LD_PRELOAD: "/tmp/injected.so"
      }
    });

    expect(result.stdout).toContain("[REDACTED:ENV:SAFE_TOKEN]");
    expect(result.stdout).toContain('"home":null');
    expect(result.stdout).toContain('"aws":null');
    expect(result.stdout).toContain('"loader":null');
    const artifact = await readFile(join(root, result.stdoutArtifact.artifactPath), "utf8");
    expect(artifact).not.toContain(secret);
    expect(artifact).toContain("[REDACTED:ENV:SAFE_TOKEN]");
  });

  test("redacts declared and runtime values from command metadata and output", async () => {
    const root = await fixtureRoot();
    const declaredSecret = "declared-secret-value";
    const runtimeSecret = "runtime-secret-value";
    const result = await runCommand(root, {
      executable: "/bin/echo",
      args: [declaredSecret, runtimeSecret]
    }, {
      artifactPrefix: ".dokion/evidence/test-command-redaction",
      timeoutSeconds: 2,
      env: {
        SAFE_TOKEN: declaredSecret,
        DOKION_PRIVATE_VALUE: runtimeSecret
      }
    });

    expect(result.command).not.toContain(declaredSecret);
    expect(result.command).not.toContain(runtimeSecret);
    expect(result.stdout).not.toContain(declaredSecret);
    expect(result.stdout).not.toContain(runtimeSecret);
    const artifact = await readFile(join(root, result.stdoutArtifact.artifactPath), "utf8");
    expect(artifact).not.toContain(declaredSecret);
    expect(artifact).not.toContain(runtimeSecret);
    expect(artifact).toContain("[REDACTED:ENV:SAFE_TOKEN]");
    expect(artifact).toContain("[REDACTED:ENV:DOKION_PRIVATE_VALUE]");
  });

  test.skipIf(!["darwin", "linux"].includes(process.platform))(
    "terminates the complete process tree on timeout",
    async () => {
      const root = await fixtureRoot();
      const childPidPath = join(root, "child.pid");
      const scriptPath = join(root, "timeout-tree.ts");
      await writeFile(scriptPath, `
process.on("SIGTERM", () => {});
const child = Bun.spawn([
  process.execPath,
  "-e",
  "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
await Bun.write(${JSON.stringify(childPidPath)}, String(child.pid));
setInterval(() => {}, 1000);
`);

      let failure: unknown;
      try {
        await runCommand(root, {
          executable: process.execPath,
          args: ["run", scriptPath]
        }, {
          artifactPrefix: ".dokion/evidence/test-timeout",
          timeoutSeconds: 0.1,
          terminationGracePeriodMs: 20,
          terminationKillWaitMs: 1000
        });
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(DokionError);
      expect((failure as DokionError).code).toBe("COMMAND_FAILED");
      expect((failure as DokionError).details).toMatchObject({
        reason: "TIMEOUT",
        termination: { groupTerminated: true }
      });

      const childPid = Number(await readFile(childPidPath, "utf8"));
      const deadline = Date.now() + 1500;
      while (pidExists(childPid) && Date.now() < deadline) {
        await Bun.sleep(10);
      }
      expect(pidExists(childPid)).toBe(false);
    }
  );

  test.skipIf(!["darwin", "linux"].includes(process.platform))(
    "keeps timeout active until descendant-held output streams close",
    async () => {
      const root = await fixtureRoot();
      const pidPath = join(root, "orphan-tree.json");
      const scriptPath = join(root, "orphan-tree.ts");
      await writeFile(scriptPath, `
const child = Bun.spawn([
  process.execPath,
  "-e",
  "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"
], { stdin: "ignore", stdout: "inherit", stderr: "inherit" });
await Bun.write(${JSON.stringify(pidPath)}, JSON.stringify({ parent: process.pid, child: child.pid }));
`);

      const execution = runCommand(root, {
        executable: process.execPath,
        args: ["run", scriptPath]
      }, {
        artifactPrefix: ".dokion/evidence/test-orphan-timeout",
        timeoutSeconds: 0.1,
        terminationGracePeriodMs: 20,
        terminationKillWaitMs: 1000
      });
      const guarded = await Promise.race([
        execution.then(
          (value) => ({ kind: "resolved" as const, value }),
          (error) => ({ kind: "rejected" as const, error })
        ),
        Bun.sleep(750).then(() => ({ kind: "hung" as const }))
      ]);

      if (guarded.kind === "hung") {
        const pids = JSON.parse(await readFile(pidPath, "utf8")) as { parent: number; child: number };
        try { process.kill(-pids.parent, "SIGKILL"); } catch {}
        await Promise.race([execution.catch(() => undefined), Bun.sleep(500)]);
      }

      expect(guarded.kind).toBe("rejected");
      if (guarded.kind === "rejected") {
        expect(guarded.error).toBeInstanceOf(DokionError);
        expect((guarded.error as DokionError).details).toMatchObject({ reason: "TIMEOUT" });
      }
    }
  );

  test("fails before execution when the platform policy is unsupported", async () => {
    const root = await fixtureRoot();
    const marker = join(root, "must-not-exist.txt");

    await expect(runCommand(root, {
      executable: process.execPath,
      args: ["-e", `await Bun.write(${JSON.stringify(marker)}, "executed")`]
    }, {
      platform: "win32",
      artifactPrefix: ".dokion/evidence/test-unsupported",
      timeoutSeconds: 2
    })).rejects.toMatchObject({ code: "UNSUPPORTED_EXECUTION" });

    expect(await Bun.file(marker).exists()).toBe(false);
  });
});
