import { afterEach, describe, expect, test } from "bun:test";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExecutionEngine } from "../../src/engine/execution-engine.ts";
import {
  captureRepositoryIdentity,
  compareRepositoryIdentities,
  normalizeRemoteIdentity,
  type RepositoryIdentity
} from "../../src/git/repository-identity.ts";
import { readEvents } from "../../src/state/event-log.ts";

const roots: string[] = [];

async function runGit(root: string, args: string[]): Promise<string> {
  const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  return stdout.trim();
}

async function createGitRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dokion-repository-identity-"));
  roots.push(root);
  await mkdir(join(root, ".dokion"), { recursive: true });
  await cp(join(process.cwd(), "dokion.json"), join(root, "dokion.json"));
  await runGit(root, ["init", "-b", "main"]);
  await runGit(root, ["config", "user.name", "Dokion Tests"]);
  await runGit(root, ["config", "user.email", "dokion@example.invalid"]);
  await writeFile(join(root, "tracked.txt"), "baseline\n");
  await runGit(root, ["add", "tracked.txt", "dokion.json"]);
  await runGit(root, ["commit", "-m", "baseline"]);
  return root;
}

async function writePausedPlaybook(root: string): Promise<void> {
  const raw = await readFile(join(process.cwd(), "playbooks/example.playbook.json"), "utf8");
  const playbook = JSON.parse(raw.replaceAll("sha256:PLACEHOLDER", `sha256:${"a".repeat(64)}`));
  const step = playbook.stages[0].steps[0];
  const command = "printf should-not-run >> identity.log";
  playbook.project.name = "identity-fixture";
  playbook.stages = [{
    id: "identity",
    name: "Identity",
    execution: "SEQUENTIAL",
    steps: [{
      ...step,
      id: "identity-step",
      responsibility: "Wait for approval before the identity test command",
      mode: "VERIFY_ONLY",
      approval: "BEFORE_WRITE",
      capability: {
        ...step.capability,
        id: "identity-capability",
        immutable_reference: `sha256:${"b".repeat(64)}`
      },
      permissions: { read: ["**/*"], write: [".dokion/**", "HARDENING.md"], network: false, shell: [command] },
      verification: [command],
      success_conditions: ["verification_exit_zero"]
    }]
  }];
  playbook.release_gates = [];
  await writeFile(join(root, ".dokion/playbook.json"), `${JSON.stringify(playbook, null, 2)}\n`);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("repository identity capture", () => {
  test("captures canonical git identity and removes remote credentials", async () => {
    const root = await createGitRoot();
    await runGit(root, ["remote", "add", "origin", "https://user:secret-token@example.com/Org/Repo.git"]);

    const identity = await captureRepositoryIdentity(root, `sha256:${"c".repeat(64)}`);

    expect(identity).toMatchObject({
      schema_version: 1,
      kind: "git",
      canonical_root: await realpath(root),
      remote: "https://example.com/Org/Repo",
      branch: "main",
      playbook_digest: `sha256:${"c".repeat(64)}`
    });
    expect(identity.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(identity.root_digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(identity.worktree_id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(identity)).not.toContain("secret-token");
  });

  test("normalizes network remotes and hashes local remotes", () => {
    expect(normalizeRemoteIdentity("git@github.com:Owner/Repo.git")).toBe("ssh://github.com/Owner/Repo");
    expect(normalizeRemoteIdentity("ssh://git@example.com:2222/Owner/Repo.git")).toBe("ssh://example.com:2222/Owner/Repo");
    expect(normalizeRemoteIdentity("/private/local/repository.git")).toMatch(/^local:sha256:[a-f0-9]{64}$/);
  });

  test("reports every material identity difference", () => {
    const expected: RepositoryIdentity = {
      schema_version: 1,
      kind: "git",
      canonical_root: "/repo/a",
      root_digest: `sha256:${"1".repeat(64)}`,
      worktree_id: `sha256:${"2".repeat(64)}`,
      remote: "https://example.com/org/repo",
      commit: "a".repeat(40),
      branch: "main",
      playbook_digest: `sha256:${"3".repeat(64)}`,
      captured_at: "2026-07-27T16:30:00.000Z"
    };
    const actual: RepositoryIdentity = {
      ...expected,
      canonical_root: "/repo/b",
      root_digest: `sha256:${"4".repeat(64)}`,
      worktree_id: `sha256:${"5".repeat(64)}`,
      remote: "https://example.com/org/other",
      commit: "b".repeat(40),
      branch: "release",
      playbook_digest: `sha256:${"6".repeat(64)}`,
      captured_at: "2026-07-27T16:31:00.000Z"
    };

    expect(compareRepositoryIdentities(expected, actual).map((difference) => difference.field)).toEqual([
      "canonical_root",
      "root_digest",
      "worktree_id",
      "remote",
      "commit",
      "branch",
      "playbook_digest"
    ]);
  });
});

describe("resume repository identity", () => {
  test("marks a nonterminal run stale before continuing after commit drift", async () => {
    const root = await createGitRoot();
    await runGit(root, ["remote", "add", "origin", "https://user:secret-token@example.com/Org/Repo.git"]);
    await writePausedPlaybook(root);

    const awaiting = await new ExecutionEngine(root).run();
    expect(awaiting.run.status).toBe("AWAITING_USER");
    expect(awaiting.repository_identity).toMatchObject({ kind: "git", branch: "main" });
    expect(JSON.stringify(awaiting)).not.toContain("secret-token");

    await writeFile(join(root, "identity-change.txt"), "new commit\n");
    await runGit(root, ["add", "identity-change.txt"]);
    await runGit(root, ["commit", "-m", "change identity"]);

    const stale = await new ExecutionEngine(root).resume();

    expect(stale.run.status).toBe("STALE");
    expect(stale.run.stale).toMatchObject({
      reason: "REPOSITORY_IDENTITY_CHANGED",
      changed_fields: expect.arrayContaining(["commit"])
    });
    expect(stale.stages[0]?.steps[0]?.status).toBe("AWAITING_APPROVAL");
    await expect(access(join(root, "identity.log"))).rejects.toBeDefined();
    expect((await readEvents(root)).at(-1)).toMatchObject({
      event: "RUN_STALE",
      payload: { reason: "REPOSITORY_IDENTITY_CHANGED", changed_fields: expect.arrayContaining(["commit"]) }
    });
  });
});
