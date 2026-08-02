import { dirname, isAbsolute, resolve } from "node:path";

interface CohortRepository {
  name: string;
  cwd: string;
  command: string[];
}

interface CohortConfig {
  repositories: CohortRepository[];
}

interface RepositoryResult {
  name: string;
  cwd: string;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

function configPathFromArgs(args: readonly string[]): string {
  const index = args.indexOf("--config");
  const value = index >= 0 ? args[index + 1] : undefined;
  if (!value || value.startsWith("-")) {
    throw new Error("Usage: bun run scripts/validate-cohort-adoption.ts --config <path>");
  }
  return resolve(value);
}

function validateConfig(value: unknown): CohortConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as CohortConfig).repositories)) {
    throw new Error("Cohort config must contain a repositories array");
  }

  const repositories = (value as CohortConfig).repositories;
  if (repositories.length === 0) throw new Error("Cohort config must contain at least one repository");

  for (const [index, repository] of repositories.entries()) {
    if (!repository || typeof repository !== "object") {
      throw new Error(`Repository entry ${index} must be an object`);
    }
    if (typeof repository.name !== "string" || repository.name.trim().length === 0) {
      throw new Error(`Repository entry ${index} requires a non-empty name`);
    }
    if (typeof repository.cwd !== "string" || repository.cwd.trim().length === 0) {
      throw new Error(`Repository ${repository.name} requires a working directory`);
    }
    if (!Array.isArray(repository.command) || repository.command.length === 0) {
      throw new Error(`Repository ${repository.name} requires a non-empty command array`);
    }
    if (repository.command.some((argument) => typeof argument !== "string" || argument.length === 0)) {
      throw new Error(`Repository ${repository.name} command arguments must be non-empty strings`);
    }
  }

  return { repositories };
}

async function runRepository(
  repository: CohortRepository,
  configDirectory: string
): Promise<RepositoryResult> {
  const cwd = isAbsolute(repository.cwd)
    ? resolve(repository.cwd)
    : resolve(configDirectory, repository.cwd);
  const child = Bun.spawn(repository.command, {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe"
  });
  const stdoutPromise = child.stdout ? new Response(child.stdout).text() : Promise.resolve("");
  const stderrPromise = child.stderr ? new Response(child.stderr).text() : Promise.resolve("");
  const exitCode = await child.exited;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

  return {
    name: repository.name,
    cwd,
    command: [...repository.command],
    exitCode,
    stdout,
    stderr
  };
}

export async function validateCohort(configPath: string): Promise<RepositoryResult[]> {
  const config = validateConfig(await Bun.file(configPath).json());
  const configDirectory = dirname(configPath);
  const results: RepositoryResult[] = [];

  for (const [index, repository] of config.repositories.entries()) {
    console.log(`[${index + 1}/${config.repositories.length}] Running ${repository.name}`);
    const result = await runRepository(repository, configDirectory);
    results.push(result);

    if (result.exitCode === 0) {
      console.log(`[PASSED] ${result.name}`);
    } else {
      console.error(`[FAILED] ${result.name} exited with code ${result.exitCode}`);
      if (result.stderr.trim()) console.error(result.stderr.trim());
    }
  }

  const failures = results.filter((result) => result.exitCode !== 0);
  if (failures.length > 0) {
    throw new Error(`Cohort validation failed: ${failures.length}/${results.length} repositories failed`);
  }

  console.log(`Cohort validation passed: ${results.length}/${results.length} repositories`);
  return results;
}

if (import.meta.main) {
  try {
    await validateCohort(configPathFromArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
