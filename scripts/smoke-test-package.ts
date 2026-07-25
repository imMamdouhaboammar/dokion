#!/usr/bin/env bun

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createPackedArchive, removePackedArchive } from "../src/distribution/package-archive.ts";

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(command: string[], cwd: string): Promise<CommandResult> {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    child.stdout ? new Response(child.stdout).text() : "",
    child.stderr ? new Response(child.stderr).text() : ""
  ]);
  return { exitCode, stdout, stderr };
}

function requireSuccess(result: CommandResult, label: string): void {
  if (result.exitCode !== 0) throw new Error(`${label} failed (${result.exitCode})\n${result.stderr}\n${result.stdout}`);
}

function parseJson(output: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`${label} did not emit JSON: ${error instanceof Error ? error.message : String(error)}\n${output}`);
  }
}

async function assertAbsent(path: string, label: string): Promise<void> {
  if (await Bun.file(path).exists()) throw new Error(`${label} existed before Dokion initialization: ${path}`);
}

export async function smokeTestPackage(root = process.cwd()): Promise<void> {
  const archive = await createPackedArchive(root);
  const project = await mkdtemp(join(tmpdir(), "dokion-clean-install-"));

  try {
    await mkdir(project, { recursive: true });
    await writeFile(join(project, "package.json"), `${JSON.stringify({ name: "dokion-smoke", private: true }, null, 2)}\n`);

    await assertAbsent(join(project, ".dokion"), ".dokion directory");
    await assertAbsent(join(project, "HARDENING.md"), "hardening report");

    const install = await run([process.execPath, "add", archive.archivePath, "--ignore-scripts", "--no-save"], project);
    requireSuccess(install, "bun add package tarball");

    const executable = join(project, "node_modules", ".bin", process.platform === "win32" ? "dokion.exe" : "dokion");
    if (!(await Bun.file(executable).exists())) throw new Error(`Installed Dokion binary was not created: ${executable}`);

    const help = await run([executable, "--help"], project);
    requireSuccess(help, "installed dokion --help");
    if (!help.stdout.includes("Dokion 0.3.0") || !help.stdout.includes("Dokion never installs")) {
      throw new Error(`Installed help output was incomplete:\n${help.stdout}`);
    }

    const validateBeforeInit = await run([executable, "validate", "--catalog-only"], project);
    requireSuccess(validateBeforeInit, "installed dokion validate --catalog-only before init");
    const validation = parseJson(validateBeforeInit.stdout, "catalog validation");
    if (validation.valid !== true) throw new Error("Built-in catalog did not validate in a clean project");
    const checked = validation.checkedFiles;
    if (!Array.isArray(checked) || !checked.includes("builtin:dokion.json")) {
      throw new Error(`Clean validation did not use the embedded catalog: ${JSON.stringify(checked)}`);
    }

    await assertAbsent(join(project, ".dokion"), ".dokion directory");
    await assertAbsent(join(project, "HARDENING.md"), "hardening report");

    const init = await run([executable, "init"], project);
    requireSuccess(init, "installed dokion init");
    const initialized = parseJson(init.stdout, "init");
    if (initialized.active_playbook_created !== false) throw new Error("dokion init claimed it created an active playbook");

    if (!(await Bun.file(join(project, ".dokion", "state.json")).exists())) throw new Error("dokion init did not create state.json");
    if (!(await Bun.file(join(project, "HARDENING.md")).exists())) throw new Error("dokion init did not create HARDENING.md");
    if (await Bun.file(join(project, ".dokion", "playbook.json")).exists()) throw new Error("dokion init silently authored an active playbook");
    if (await Bun.file(join(project, "dokion.json")).exists()) throw new Error("dokion init copied the built-in catalog into the user project");

    const state = JSON.parse(await readFile(join(project, ".dokion", "state.json"), "utf8")) as { run?: { status?: string } };
    if (state.run?.status !== "STOPPED") throw new Error(`Initialized run status was ${String(state.run?.status)} instead of STOPPED`);

    const doctor = await run([executable, "doctor"], project);
    requireSuccess(doctor, "installed dokion doctor");
    const health = parseJson(doctor.stdout, "doctor");
    if (health.healthy !== true) throw new Error(`Installed doctor was unhealthy: ${doctor.stdout}`);

    const tools = await run([executable, "tools", "list"], project);
    requireSuccess(tools, "installed dokion tools list");
    const catalogTools = JSON.parse(tools.stdout) as unknown[];
    if (!Array.isArray(catalogTools) || catalogTools.length === 0) throw new Error("Installed CLI could not read the built-in catalog");
  } finally {
    await rm(project, { recursive: true, force: true });
    await removePackedArchive(archive);
  }
}

if (import.meta.main) {
  await smokeTestPackage();
  console.log(JSON.stringify({ valid: true, smoke_test: "clean-bun-tarball-install" }, null, 2));
}
