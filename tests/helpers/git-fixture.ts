async function runGit(root: string, args: string[]): Promise<void> {
  const child = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore"
  });
  const [, stderr, exitCode] = await Promise.all([
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : "",
    child.exited
  ]);
  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

export async function initializeGitFixture(root: string): Promise<void> {
  await runGit(root, ["init", "-b", "main"]);
  await runGit(root, ["config", "user.name", "Dokion Tests"]);
  await runGit(root, ["config", "user.email", "dokion@example.invalid"]);
  await runGit(root, ["add", "--all"]);
  await runGit(root, ["commit", "-m", "fixture baseline"]);
}
