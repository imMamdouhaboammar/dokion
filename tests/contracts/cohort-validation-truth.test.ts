import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const cohortScript = join(root, "scripts", "validate-cohort-adoption.ts");

describe("external cohort validation truth boundary", () => {
  test("executes repository commands and fails closed on a failed repository", async () => {
    expect(await Bun.file(cohortScript).exists()).toBe(true);
    const fixtureRoot = await mkdtemp(join(tmpdir(), "dokion-cohort-"));
    const markerPath = join(fixtureRoot, "command-ran.txt");
    const configPath = join(fixtureRoot, "cohort.json");

    try {
      await Bun.write(configPath, JSON.stringify({
        repositories: [
          {
            name: "deliberately-failing-repository",
            cwd: fixtureRoot,
            command: [
              process.execPath,
              "-e",
              `await Bun.write(${JSON.stringify(markerPath)}, "ran"); process.exit(7)`
            ]
          }
        ]
      }));

      const child = Bun.spawn(
        [process.execPath, "run", cohortScript, "--config", configPath],
        {
          cwd: root,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe"
        }
      );
      const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
      const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
      const exitCode = await child.exited;
      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

      expect(exitCode).toBe(1);
      expect(await Bun.file(markerPath).text()).toBe("ran");
      expect(stdout).toContain("Running deliberately-failing-repository");
      expect(stdout).not.toContain("[PASSED]");
      expect(stdout).not.toContain("Cohort validation passed");
      expect(stderr).toContain("[FAILED] deliberately-failing-repository exited with code 7");
      expect(stderr).toContain("Cohort validation failed: 1/1 repositories failed");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
