import { afterEach, describe, expect, test } from "bun:test";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validatePlaybookData } from "../../src/contracts/schema-validator.ts";
import { ExecutionEngine } from "../../src/engine/execution-engine.ts";
import { parseWorktreeStatus, readRegularFileSnapshot } from "../../src/git/worktree-policy.ts";

const roots: string[] = [];

async function runGit(root: string, args: string[]): Promise<string> {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}
async function createGitRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-worktree-policy-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await runGit(root, ["init", "-b", "main"]);
  await runGit(root, ["config", "user.name", "Dokion Tests"]);
  await runGit(root, ["config", "user.email", "dokion@example.invalid"]);
  await writeFile(join(root, "tracked.txt"), "baseline\n");
  await writeFile(join(root, "delete-me.txt"), "delete baseline\n");
  await writeFile(join(root, ".gitignore"), ".dokion/\nHARDENING.md\n");
  await runGit(root, ["add", "tracked.txt", "delete-me.txt", "dokion.json", ".gitignore"]);
  await runGit(root, ["commit", "-m", "baseline"]);
  return root;
}

async function readFixturePlaybook(): Promise<Record<string, any>> {
  const raw = await readFile(join(process.cwd(), "playbooks/example.playbook.json"), "utf8");
  return JSON.parse(raw.replaceAll("sha256:PLACEHOLDER", `sha256:${"a".repeat(64)}`));
}

async function writePausedPlaybook(
  root: string,
  policy?: "clean-only" | "allow-existing-dirty" | "snapshot-existing-dirty"
): Promise<Record<string, any>> {
  const playbook = await readFixturePlaybook();
  const template = playbook.stages[0].steps[0];
  playbook.project.name = "worktree-policy-fixture";
  playbook.enforcement = {
    ...playbook.enforcement,
    ...(policy ? { worktree_policy: policy } : {})
  };
  if (!policy) delete playbook.enforcement.worktree_policy;
  playbook.stages = [{
    id: "policy",
    name: "Policy",
    execution: "SEQUENTIAL",
    steps: [{
      ...template,
      id: "policy-step",
      responsibility: "Pause before executing the worktree policy fixture",
      mode: "VERIFY_ONLY",
      approval: "BEFORE_WRITE",
      capability: {
        ...template.capability,
        id: "policy-capability",
        immutable_reference: `sha256:${"b".repeat(64)}`
      },
      permissions: {
        read: ["**/*"],
        write: [".dokion/**", "HARDENING.md"],
        network: false,
        shell: ["printf should-not-run >> policy.log"]
      },
      verification: ["printf should-not-run >> policy.log"],
      success_conditions: ["verification_exit_zero"]
    }]
  }];
  playbook.release_gates = [];
  await writeFile(
    join(root, ".dokion/playbook.json"),
    `${JSON.stringify(playbook, null, 2)}\n`
  );
  return playbook;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("declared dirty-worktree policy", () => {
  test("defaults write-capable runs to clean-only and blocks existing changes", async () => {
    const root = await createGitRoot();
    await writePausedPlaybook(root);
    await writeFile(join(root, "tracked.txt"), "user change\n");

    await expect(new ExecutionEngine(root).run()).rejects.toMatchObject({
      code: "DIRTY_WORKTREE_BLOCKED",
      details: { policy: "clean-only", paths: ["tracked.txt"] }
    });
    await expect(access(join(root, ".dokion/state.json"))).rejects.toBeDefined();
    await expect(access(join(root, "policy.log"))).rejects.toBeDefined();
  });

  test("allows a clean worktree with the default clean-only policy", async () => {
    const root = await createGitRoot();
    await writePausedPlaybook(root);

    const state = await new ExecutionEngine(root).run();
    const baseline = JSON.parse(
      await readFile(join(root, ".dokion/worktree-baseline.json"), "utf8")
    );

    expect(state.run.status).toBe("AWAITING_USER");
    expect(state.baseline?.worktree_clean).toBe(true);
    expect(baseline).toMatchObject({
      schema_version: 1,
      policy: "clean-only",
      dirty: false,
      entries: []
    });
  });

  test("records staged unstaged and untracked changes when existing dirty work is allowed", async () => {
    const root = await createGitRoot();
    await writePausedPlaybook(root, "allow-existing-dirty");
    await writeFile(join(root, "tracked.txt"), "staged user change\n");
    await runGit(root, ["add", "tracked.txt"]);
    await writeFile(join(root, "tracked.txt"), "staged and unstaged user change\n");
    await writeFile(join(root, "untracked.txt"), "untracked user change\n");
    await symlink("tracked.txt", join(root, "user-link"));

    const state = await new ExecutionEngine(root).run();
    const baseline = JSON.parse(
      await readFile(join(root, ".dokion/worktree-baseline.json"), "utf8")
    );

    expect(state.run.status).toBe("AWAITING_USER");
    expect(baseline).toMatchObject({
      schema_version: 1,
      policy: "allow-existing-dirty",
      entries: [
        { path: "tracked.txt", status: "MM", kind: "file" },
        { path: "untracked.txt", status: "??", kind: "file" },
        { path: "user-link", status: "??", kind: "symlink" }
      ]
    });
    expect(state.baseline?.worktree_clean).toBe(false);
    expect(baseline.snapshot_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(baseline.entries.every((entry: Record<string, unknown>) => !("content" in entry))).toBe(true);
    expect(baseline.entries.every((entry: Record<string, unknown>) => !("target" in entry))).toBe(true);
  });

  test("captures exact existing content when snapshot-existing-dirty is declared", async () => {
    const root = await createGitRoot();
    await writePausedPlaybook(root, "snapshot-existing-dirty");
    await writeFile(join(root, "tracked.txt"), "staged tracked bytes\n");
    await runGit(root, ["add", "tracked.txt"]);
    await writeFile(join(root, "tracked.txt"), "dirty tracked bytes\n");
    await rm(join(root, "delete-me.txt"));
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 1, 2, 255]));
    await symlink("tracked.txt", join(root, "snapshot-link"));

    const state = await new ExecutionEngine(root).run();
    const baseline = JSON.parse(
      await readFile(join(root, ".dokion/worktree-baseline.json"), "utf8")
    );
    const entries = new Map(
      baseline.entries.map((entry: Record<string, unknown>) => [entry.path, entry])
    );

    expect(state.run.status).toBe("AWAITING_USER");
    expect(baseline.index_patch_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(baseline.worktree_patch_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Buffer.from(baseline.index_patch, "base64").toString("utf8")).toContain("tracked.txt");
    expect(Buffer.from(baseline.worktree_patch, "base64").toString("utf8")).toContain("tracked.txt");
    expect(entries.get("tracked.txt")).toMatchObject({
      status: "MM",
      kind: "file",
      content: Buffer.from("dirty tracked bytes\n").toString("base64")
    });
    expect(entries.get("delete-me.txt")).toMatchObject({ status: " D", kind: "missing" });
    expect(entries.get("binary.bin")).toMatchObject({
      status: "??",
      kind: "file",
      content: Buffer.from([0, 1, 2, 255]).toString("base64")
    });
    expect(entries.get("snapshot-link")).toMatchObject({
      status: "??",
      kind: "symlink",
      target: "tracked.txt"
    });

    const expectedStatus = await runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    const indexPatchPath = join(root, ".dokion/index.patch");
    const worktreePatchPath = join(root, ".dokion/worktree.patch");
    await writeFile(indexPatchPath, Buffer.from(baseline.index_patch, "base64"));
    await writeFile(worktreePatchPath, Buffer.from(baseline.worktree_patch, "base64"));
    await runGit(root, ["reset", "--hard", "HEAD"]);
    await rm(join(root, "binary.bin"), { force: true });
    await rm(join(root, "snapshot-link"), { force: true });
    await runGit(root, ["apply", "--cached", indexPatchPath]);
    await runGit(root, ["checkout-index", "--all", "--force"]);
    await runGit(root, ["apply", worktreePatchPath]);

    for (const entry of baseline.entries as Array<Record<string, any>>) {
      if (entry.status !== "??") continue;
      const path = join(root, String(entry.path));
      if (entry.kind === "file") {
        await writeFile(path, Buffer.from(String(entry.content), "base64"));
        await chmod(path, Number(entry.mode));
      } else if (entry.kind === "symlink") {
        await symlink(String(entry.target), path);
      }
    }

    expect(await runGit(root, ["status", "--porcelain=v1", "--untracked-files=all"]))
      .toBe(expectedStatus);
    expect(await runGit(root, ["show", ":tracked.txt"])).toBe("staged tracked bytes");
    expect(await readFile(join(root, "tracked.txt"), "utf8")).toBe("dirty tracked bytes\n");
  });

  test("parses rename and copy status records without treating source paths as records", () => {
    const bytes = new TextEncoder().encode(
      "R  renamed.txt\0old.txt\0C  copied.txt\0source.txt\0"
    );

    expect(parseWorktreeStatus(bytes)).toEqual([
      { path: "copied.txt", status: "C " },
      { path: "old.txt", status: " D" },
      { path: "renamed.txt", status: "R " }
    ]);
  });

  test("fails closed when dirty entry count exceeds the configured capture bound", () => {
    const bytes = new TextEncoder().encode("?? one.txt\0?? two.txt\0");

    expect(() => parseWorktreeStatus(bytes, 1)).toThrow();
  });

  test("fails closed when Git returns a path that is not valid UTF-8", () => {
    expect(() => parseWorktreeStatus(Uint8Array.from([63, 63, 32, 255, 0]))).toThrow();
  });

  test("refuses to load a regular file larger than the capture bound", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-worktree-policy-size-"));
    roots.push(root);
    const path = join(root, "large.txt");
    await writeFile(path, "12345");

    await expect(readRegularFileSnapshot(path, undefined, 4)).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED"
    });
  });

  test("refuses to follow a symlink through the regular-file snapshot path", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-worktree-policy-nofollow-"));
    roots.push(root);
    const secret = join(root, "secret.txt");
    const link = join(root, "link.txt");
    await writeFile(secret, "must-not-be-read\n");
    await symlink(secret, link);

    await expect(readRegularFileSnapshot(link)).rejects.toMatchObject({
      code: "WORKTREE_SNAPSHOT_FAILED"
    });
  });

  test("blocks write-capable execution when Git worktree state is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "dokion-worktree-policy-non-git-"));
    roots.push(root);
    await mkdir(join(root, ".dokion"), { recursive: true });
    await writePausedPlaybook(root, "allow-existing-dirty");

    await expect(new ExecutionEngine(root).run()).rejects.toMatchObject({
      code: "WORKTREE_POLICY_UNAVAILABLE",
      details: { exit_code: 128 }
    });
    await expect(access(join(root, ".dokion/state.json"))).rejects.toBeDefined();
  });

  test("accepts only the three declared worktree policies", async () => {
    const root = await createGitRoot();
    const accepted = [
      "clean-only",
      "allow-existing-dirty",
      "snapshot-existing-dirty"
    ];

    for (const policy of accepted) {
      const playbook = await readFixturePlaybook();
      playbook.enforcement = { ...playbook.enforcement, worktree_policy: policy };
      expect(await validatePlaybookData(root, playbook)).toEqual([]);
    }

    const invalid = await readFixturePlaybook();
    invalid.enforcement = { ...invalid.enforcement, worktree_policy: "ignore-everything" };
    const issues = await validatePlaybookData(root, invalid);
    expect(issues.some((issue) => issue.instancePath === "/enforcement/worktree_policy")).toBe(true);
  });
});
